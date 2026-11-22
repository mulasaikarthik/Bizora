// Persistence for Bizora: Dual-Mode Engine (Supabase PostgreSQL + in-memory/file fallback for tests)
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  balanceOf,
  canDeleteClient,
  canDeleteInvoice,
  canRemind,
  canSendInvoice,
  normaliseExpense,
  todayISO,
  validateClient,
  validateExpenseInput,
  validateInvoiceInput,
  validatePaymentInput,
  validateSettingsInput,
} from './domain.mjs';
import { buildSeed } from './seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(here, 'data', 'db.json');
const COLLECTIONS = ['clients', 'invoices', 'payments', 'expenses', 'shoots', 'notifications'];

// HTTP status per business-rule code. Anything unlisted is 422.
const STATUS_BY_CODE = {
  NOT_FOUND: 404,
  INVALID_INPUT: 422,
  NO_ITEMS: 422,
  EXCEEDS_BALANCE: 422,
  HAS_INVOICES: 409,
  HAS_PAYMENTS: 409,
  NOT_DRAFT: 409,
  LOCKED_BY_PAYMENTS: 409,
  DRAFT_INVOICE: 409,
  NOT_REMINDABLE: 409,
};

function fail(code, error, fields) {
  const result = { ok: false, status: STATUS_BY_CODE[code] ?? 422, code, error };
  if (fields && Object.keys(fields).length > 0) result.fields = fields;
  return result;
}

function fromDomain(result) {
  return fail(result.code, result.error, result.fields);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeInput(existing, input) {
  return isPlainObject(input) ? { ...existing, ...input } : input;
}

function newId(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

function newUuid() {
  return randomUUID();
}

function withLineIds(items) {
  return (items || []).map((it) => ({
    id: it.id || newUuid(),
    description: it.description,
    quantity: it.quantity,
    rate: it.rate,
  }));
}

let db = null;
let file = null;
let loading = null;

function normaliseShape(raw) {
  const out = { ...raw };
  for (const key of COLLECTIONS) if (!Array.isArray(out[key])) out[key] = [];
  if (!isPlainObject(out.settings)) out.settings = buildSeed().settings;
  return out;
}

async function writeAtomic(target, data) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, target);
  } catch (err) {
    await fs.unlink(tmp).catch(() => {});
    throw err;
  }
}

async function readOrSeed(target) {
  let text;
  try {
    text = await fs.readFile(target, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    const seeded = normaliseShape(buildSeed());
    await writeAtomic(target, seeded);
    return seeded;
  }
  try {
    return normaliseShape(JSON.parse(text));
  } catch {
    const seeded = normaliseShape(buildSeed());
    await writeAtomic(target, seeded);
    return seeded;
  }
}

// Loads in-memory or JSON DB (used in test mode)
async function loadLocalDb() {
  const target = process.env.DB_PATH || DEFAULT_DB_PATH;
  if (db !== null && file === target) return db;
  if (loading !== null) return loading;
  loading = (async () => {
    try {
      db = await readOrSeed(target);
      file = target;
      return db;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

let queue = Promise.resolve();
function mutateLocal(fn) {
  const run = async () => {
    const current = await loadLocalDb();
    const draft = clone(current);
    const result = await fn(draft);
    if (!result || !result.ok) return result;
    const target = process.env.DB_PATH || DEFAULT_DB_PATH;
    await writeAtomic(target, draft);
    db = draft;
    file = target;
    return result;
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

// ---------- Supabase Database Loaders ----------

async function loadSupabaseDb(userContext) {
  const { user, supabase } = userContext;
  const userId = user.id;

  const [clientsRes, invoicesRes, paymentsRes, expensesRes, settingsRes, shootsRes, notifsRes] =
    await Promise.all([
      supabase.from('clients').select('*').eq('user_id', userId),
      supabase.from('invoices').select('*, invoice_items(*)').eq('user_id', userId),
      supabase.from('payments').select('*').eq('user_id', userId),
      supabase.from('expenses').select('*').eq('user_id', userId),
      supabase.from('business_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('shoots').select('*').eq('user_id', userId),
      supabase.from('notifications').select('*').eq('user_id', userId),
    ]);

  const defaultSeed = buildSeed();

  const clients = (clientsRes.data || []).map((row) => ({
    id: row.id,
    name: row.name,
    company: row.company || '',
    email: row.email,
    phone: row.phone || '',
    address: row.address || '',
  }));

  const invoices = (invoicesRes.data || []).map((row) => ({
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: row.status,
    taxRate: Number(row.tax_rate) || 0,
    notes: row.notes || '',
    lastRemindedAt: row.last_reminded_at || undefined,
    items: (row.invoice_items || []).map((it) => ({
      id: it.id,
      description: it.description,
      quantity: Number(it.quantity) || 1,
      rate: Number(it.rate) || 0,
    })),
  }));

  const payments = (paymentsRes.data || []).map((row) => ({
    id: row.id,
    invoiceId: row.invoice_id,
    amount: Number(row.amount) || 0,
    date: row.date,
    method: row.method === 'Credit card' ? 'Card' : row.method,
    notes: row.notes || '',
  }));

  const expenses = (expensesRes.data || []).map((row) => ({
    id: row.id,
    date: row.date,
    category: row.category,
    vendor: row.vendor,
    amount: Number(row.amount) || 0,
    receipt: row.receipt || undefined,
  }));

  const shoots = (shootsRes.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    clientId: row.client_id || '',
    location: row.location || '',
  }));

  const notifications = (notifsRes.data || []).map((row) => ({
    id: row.id,
    text: row.text,
    date: row.date,
    read: Boolean(row.read),
  }));

  const settingsRow = settingsRes.data;
  const settings = {
    businessName: settingsRow?.business_name || defaultSeed.settings.businessName,
    address: settingsRow?.address || defaultSeed.settings.address,
    taxNumber: settingsRow?.tax_number || defaultSeed.settings.taxNumber,
    currency: settingsRow?.currency || defaultSeed.settings.currency,
    invoicePrefix: settingsRow?.invoice_prefix || defaultSeed.settings.invoicePrefix,
    nextInvoiceNumber: settingsRow?.next_invoice_number || defaultSeed.settings.nextInvoiceNumber,
    paymentTermsDays: settingsRow?.payment_terms_days ?? defaultSeed.settings.paymentTermsDays,
    defaultTaxRate: settingsRow?.default_tax_rate ?? defaultSeed.settings.defaultTaxRate,
    notifyPaymentReceived: settingsRow?.email_notifications ?? defaultSeed.settings.notifyPaymentReceived,
    notifyOverdue: settingsRow?.payment_alerts ?? defaultSeed.settings.notifyOverdue,
    notifyShootReminders: defaultSeed.settings.notifyShootReminders,
    reducedMotionOverride: settingsRow?.reduced_motion ?? defaultSeed.settings.reducedMotionOverride,
  };

  return { clients, invoices, payments, expenses, shoots, notifications, settings };
}

// ---------- Unified loadDb ----------

export async function loadDb(userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    return loadSupabaseDb(userContext);
  }
  return loadLocalDb();
}

// ---------- clients ----------

export async function createClient(input, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const r = validateClient(input);
    if (!r.ok) return fromDomain(r);
    const id = input?.id && input.id.length > 20 ? input.id : newUuid();
    const { data, error } = await userContext.supabase
      .from('clients')
      .insert({
        id,
        user_id: userContext.user.id,
        name: r.value.name,
        company: r.value.company || '',
        email: r.value.email,
        phone: r.value.phone || '',
        address: r.value.address || '',
      })
      .select()
      .single();
    if (error) return fail('INVALID_INPUT', error.message);
    return { ok: true, value: { id: data.id, ...r.value } };
  }

  return mutateLocal((draft) => {
    const r = validateClient(input);
    if (!r.ok) return fromDomain(r);
    const client = { id: newId('cl'), ...r.value };
    draft.clients.push(client);
    return { ok: true, value: client };
  });
}

export async function updateClient(id, input, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const { data: existing } = await userContext.supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('user_id', userContext.user.id)
      .maybeSingle();
    if (!existing) return fail('NOT_FOUND', 'Client not found');
    const merged = mergeInput(existing, input);
    const r = validateClient(merged);
    if (!r.ok) return fromDomain(r);
    const { data, error } = await userContext.supabase
      .from('clients')
      .update({
        name: r.value.name,
        company: r.value.company || '',
        email: r.value.email,
        phone: r.value.phone || '',
        address: r.value.address || '',
      })
      .eq('id', id)
      .eq('user_id', userContext.user.id)
      .select()
      .single();
    if (error) return fail('INVALID_INPUT', error.message);
    return { ok: true, value: { id: data.id, ...r.value } };
  }

  return mutateLocal((draft) => {
    const idx = draft.clients.findIndex((c) => c.id === id);
    if (idx < 0) return fail('NOT_FOUND', 'Client not found');
    const r = validateClient(mergeInput(draft.clients[idx], input));
    if (!r.ok) return fromDomain(r);
    draft.clients[idx] = { id, ...r.value };
    return { ok: true, value: draft.clients[idx] };
  });
}

export async function deleteClient(id, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const db = await loadSupabaseDb(userContext);
    const client = db.clients.find((c) => c.id === id);
    if (!client) return fail('NOT_FOUND', 'Client not found');
    if (!canDeleteClient(client, db.invoices)) {
      return fail('HAS_INVOICES', 'Cannot delete client with existing invoices');
    }
    const { error } = await userContext.supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('user_id', userContext.user.id);
    if (error) return fail('INVALID_INPUT', error.message);
    return { ok: true, value: { id, deleted: true } };
  }

  return mutateLocal((draft) => {
    const client = draft.clients.find((c) => c.id === id);
    if (!client) return fail('NOT_FOUND', 'Client not found');
    if (!canDeleteClient(client, draft.invoices)) {
      return fail('HAS_INVOICES', 'Cannot delete client with existing invoices');
    }
    draft.clients = draft.clients.filter((c) => c.id !== id);
    return { ok: true, value: { id, deleted: true } };
  });
}

// ---------- invoices ----------

export async function createInvoice(input, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const db = await loadSupabaseDb(userContext);
    const r = validateInvoiceInput(input, { clients: db.clients, settings: db.settings });
    if (!r.ok) return fromDomain(r);

    const invoiceId = input?.id && input.id.length > 20 ? input.id : newUuid();
    const prefix = db.settings.invoicePrefix || 'INV-';
    const nextNumber = db.settings.nextInvoiceNumber || 1001;
    const number = input?.number || `${prefix}${nextNumber}`;

    const { error: invErr } = await userContext.supabase.from('invoices').insert({
      id: invoiceId,
      user_id: userContext.user.id,
      client_id: r.value.clientId,
      number,
      issue_date: r.value.issueDate,
      due_date: r.value.dueDate,
      status: 'Draft',
      tax_rate: r.value.taxRate,
      notes: r.value.notes || '',
    });
    if (invErr) return fail('INVALID_INPUT', invErr.message);

    const lineItems = withLineIds(r.value.items).map((it) => ({
      id: it.id && it.id.length > 20 ? it.id : newUuid(),
      invoice_id: invoiceId,
      description: it.description,
      quantity: it.quantity,
      rate: it.rate,
    }));

    if (lineItems.length > 0) {
      await userContext.supabase.from('invoice_items').insert(lineItems);
    }

    await userContext.supabase.from('business_settings').upsert({
      user_id: userContext.user.id,
      next_invoice_number: nextNumber + 1,
    });

    return {
      ok: true,
      value: {
        id: invoiceId,
        number,
        ...r.value,
        items: lineItems,
        status: 'Draft',
      },
    };
  }

  return mutateLocal((draft) => {
    const r = validateInvoiceInput(input, { clients: draft.clients, settings: draft.settings });
    if (!r.ok) return fromDomain(r);
    const number = `${draft.settings.invoicePrefix}${draft.settings.nextInvoiceNumber}`;
    draft.settings.nextInvoiceNumber += 1;
    const invoice = {
      id: newId('inv'),
      number,
      clientId: r.value.clientId,
      issueDate: r.value.issueDate,
      dueDate: r.value.dueDate,
      status: 'Draft',
      taxRate: r.value.taxRate,
      notes: r.value.notes ?? '',
      items: withLineIds(r.value.items),
    };
    draft.invoices.push(invoice);
    return { ok: true, value: invoice };
  });
}

export async function updateInvoice(id, input, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const db = await loadSupabaseDb(userContext);
    const existing = db.invoices.find((x) => x.id === id);
    if (!existing) return fail('NOT_FOUND', 'Invoice not found');

    const merged = mergeInput(existing, input);
    const r = validateInvoiceInput(merged, { clients: db.clients, settings: db.settings });
    if (!r.ok) return fromDomain(r);

    const hasPayments = db.payments.some((p) => p.invoiceId === id);
    if (hasPayments) {
      if (
        r.value.clientId !== existing.clientId ||
        r.value.taxRate !== existing.taxRate ||
        JSON.stringify(r.value.items) !== JSON.stringify(existing.items)
      ) {
        return fail('LOCKED_BY_PAYMENTS', 'Cannot edit items or tax rate once payments exist');
      }
    }

    await userContext.supabase
      .from('invoices')
      .update({
        client_id: r.value.clientId,
        due_date: r.value.dueDate,
        tax_rate: r.value.taxRate,
        notes: r.value.notes || '',
      })
      .eq('id', id)
      .eq('user_id', userContext.user.id);

    return { ok: true, value: { ...existing, ...r.value } };
  }

  return mutateLocal((draft) => {
    const idx = draft.invoices.findIndex((x) => x.id === id);
    if (idx < 0) return fail('NOT_FOUND', 'Invoice not found');
    const existing = draft.invoices[idx];
    const r = validateInvoiceInput(mergeInput(existing, input), {
      clients: draft.clients,
      settings: draft.settings,
    });
    if (!r.ok) return fromDomain(r);

    const hasPayments = draft.payments.some((p) => p.invoiceId === id);
    if (hasPayments) {
      if (
        r.value.clientId !== existing.clientId ||
        r.value.taxRate !== existing.taxRate ||
        JSON.stringify(r.value.items) !== JSON.stringify(existing.items)
      ) {
        return fail('LOCKED_BY_PAYMENTS', 'Cannot edit items or tax rate once payments exist');
      }
    }

    draft.invoices[idx] = {
      ...existing,
      clientId: r.value.clientId,
      issueDate: r.value.issueDate,
      dueDate: r.value.dueDate,
      items: withLineIds(r.value.items),
      taxRate: r.value.taxRate,
      notes: r.value.notes ?? '',
    };
    return { ok: true, value: draft.invoices[idx] };
  });
}

export async function sendInvoice(id, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const db = await loadSupabaseDb(userContext);
    const inv = db.invoices.find((x) => x.id === id);
    if (!inv) return fail('NOT_FOUND', 'Invoice not found');
    const r = canSendInvoice(inv);
    if (!r.ok) return fromDomain(r);

    await userContext.supabase
      .from('invoices')
      .update({ status: 'Sent' })
      .eq('id', id)
      .eq('user_id', userContext.user.id);

    return { ok: true, value: { ...inv, status: 'Sent' } };
  }

  return mutateLocal((draft) => {
    const inv = draft.invoices.find((x) => x.id === id);
    if (!inv) return fail('NOT_FOUND', 'Invoice not found');
    const r = canSendInvoice(inv);
    if (!r.ok) return fromDomain(r);
    inv.status = 'Sent';
    inv.sentAt = new Date().toISOString();
    return { ok: true, value: inv };
  });
}

export async function deleteInvoice(id, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const db = await loadSupabaseDb(userContext);
    const inv = db.invoices.find((x) => x.id === id);
    if (!inv) return fail('NOT_FOUND', 'Invoice not found');
    const r = canDeleteInvoice(inv, db.payments);
    if (!r.ok) return fromDomain(r);

    await userContext.supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('user_id', userContext.user.id);

    return { ok: true, value: { id, deleted: true } };
  }

  return mutateLocal((draft) => {
    const idx = draft.invoices.findIndex((x) => x.id === id);
    if (idx < 0) return fail('NOT_FOUND', 'Invoice not found');
    const r = canDeleteInvoice(draft.invoices[idx], draft.payments);
    if (!r.ok) return fromDomain(r);
    draft.invoices.splice(idx, 1);
    return { ok: true, value: { id, deleted: true } };
  });
}

export async function markReminderSent(invoiceId, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const db = await loadSupabaseDb(userContext);
    const inv = db.invoices.find((x) => x.id === invoiceId);
    if (!inv) return fail('NOT_FOUND', 'Invoice not found');
    const r = canRemind(inv, db.payments, todayISO());
    if (!r.ok) return fromDomain(r);

    const now = new Date().toISOString();
    await userContext.supabase
      .from('invoices')
      .update({ last_reminded_at: now })
      .eq('id', invoiceId)
      .eq('user_id', userContext.user.id);

    await userContext.supabase.from('reminders').insert({
      id: newUuid(),
      user_id: userContext.user.id,
      invoice_id: invoiceId,
      sent_at: now,
      type: 'follow_up',
    });

    return { ok: true, value: { ...inv, lastRemindedAt: now } };
  }

  return mutateLocal((draft) => {
    const inv = draft.invoices.find((x) => x.id === invoiceId);
    if (!inv) return fail('NOT_FOUND', 'Invoice not found');
    const r = canRemind(inv, draft.payments, todayISO());
    if (!r.ok) return fromDomain(r);
    inv.reminders = [...(Array.isArray(inv.reminders) ? inv.reminders : []), { at: new Date().toISOString() }];
    return { ok: true, value: inv };
  });
}

// ---------- payments ----------

export async function recordPayment(invoiceId, input, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    if (typeof invoiceId !== 'string' || invoiceId === '') {
      return fail('INVALID_INPUT', 'Choose an invoice', { invoiceId: 'Choose an invoice' });
    }
    const db = await loadSupabaseDb(userContext);
    const invoice = db.invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return fail('NOT_FOUND', 'Invoice not found');

    const r = validatePaymentInput(input, { invoice, payments: db.payments, today: todayISO() });
    if (!r.ok) return fromDomain(r);

    const paymentId = input?.id && input.id.length > 20 ? input.id : newUuid();
    const dbMethod = r.value.method === 'Card' ? 'Credit card' : r.value.method;

    const { error: payErr } = await userContext.supabase.from('payments').insert({
      id: paymentId,
      user_id: userContext.user.id,
      invoice_id: invoice.id,
      amount: r.value.amount,
      date: r.value.date,
      method: dbMethod,
      notes: r.value.notes || '',
    });
    if (payErr) return fail('INVALID_INPUT', payErr.message);

    const payment = { id: paymentId, ...r.value, invoiceId: invoice.id, createdAt: new Date().toISOString() };
    const updatedPayments = [...db.payments, payment];
    const newStatus = balanceOf(invoice, updatedPayments) === 0 ? 'Paid' : 'Partially paid';

    await userContext.supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', invoice.id)
      .eq('user_id', userContext.user.id);

    return { ok: true, value: payment };
  }

  return mutateLocal((draft) => {
    if (typeof invoiceId !== 'string' || invoiceId === '') {
      return fail('INVALID_INPUT', 'Choose an invoice', { invoiceId: 'Choose an invoice' });
    }
    const invoice = draft.invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return fail('NOT_FOUND', 'Invoice not found');
    const r = validatePaymentInput(input, { invoice, payments: draft.payments, today: todayISO() });
    if (!r.ok) return fromDomain(r);
    const payment = { id: newId('pay'), ...r.value, invoiceId, createdAt: new Date().toISOString() };
    draft.payments.push(payment);
    invoice.status = balanceOf(invoice, draft.payments) === 0 ? 'Paid' : 'Partially paid';
    return { ok: true, value: payment };
  });
}

// ---------- expenses ----------

export async function createExpense(input, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const r = validateExpenseInput(input);
    if (!r.ok) return fromDomain(r);

    const expenseId = input?.id && input.id.length > 20 ? input.id : newUuid();
    const { error } = await userContext.supabase.from('expenses').insert({
      id: expenseId,
      user_id: userContext.user.id,
      category: r.value.category,
      vendor: r.value.vendor,
      amount: r.value.amount,
      date: r.value.date,
      receipt: r.value.receipt || '',
    });
    if (error) return fail('INVALID_INPUT', error.message);
    return { ok: true, value: { id: expenseId, ...r.value } };
  }

  return mutateLocal((draft) => {
    const r = validateExpenseInput(input);
    if (!r.ok) return fromDomain(r);
    const expense = { id: newId('exp'), ...r.value };
    draft.expenses.push(expense);
    return { ok: true, value: expense };
  });
}

export async function updateExpense(id, input, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const db = await loadSupabaseDb(userContext);
    const existing = db.expenses.find((e) => e.id === id);
    if (!existing) return fail('NOT_FOUND', 'Expense not found');

    const r = validateExpenseInput(mergeInput(normaliseExpense(existing), input));
    if (!r.ok) return fromDomain(r);

    await userContext.supabase
      .from('expenses')
      .update({
        category: r.value.category,
        vendor: r.value.vendor,
        amount: r.value.amount,
        date: r.value.date,
        receipt: r.value.receipt || '',
      })
      .eq('id', id)
      .eq('user_id', userContext.user.id);

    return { ok: true, value: { id, ...r.value } };
  }

  return mutateLocal((draft) => {
    const idx = draft.expenses.findIndex((e) => e.id === id);
    if (idx < 0) return fail('NOT_FOUND', 'Expense not found');
    const r = validateExpenseInput(mergeInput(normaliseExpense(draft.expenses[idx]), input));
    if (!r.ok) return fromDomain(r);
    draft.expenses[idx] = { id, ...r.value };
    return { ok: true, value: draft.expenses[idx] };
  });
}

export async function deleteExpense(id, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const { error } = await userContext.supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', userContext.user.id);
    if (error) return fail('NOT_FOUND', 'Expense not found');
    return { ok: true, value: { id, deleted: true } };
  }

  return mutateLocal((draft) => {
    const idx = draft.expenses.findIndex((e) => e.id === id);
    if (idx < 0) return fail('NOT_FOUND', 'Expense not found');
    draft.expenses.splice(idx, 1);
    return { ok: true, value: { id, deleted: true } };
  });
}

// ---------- settings ----------

export async function updateSettings(input, userContext) {
  if (userContext && userContext.user && userContext.supabase) {
    const r = validateSettingsInput(input);
    if (!r.ok) return fromDomain(r);

    await userContext.supabase.from('business_settings').upsert({
      user_id: userContext.user.id,
      currency: r.value.currency,
      tax_number: r.value.taxNumber,
      invoice_prefix: r.value.invoicePrefix,
      payment_terms_days: r.value.paymentTermsDays,
      default_tax_rate: r.value.defaultTaxRate,
      email_notifications: r.value.notifyPaymentReceived,
      payment_alerts: r.value.notifyOverdue,
      reduced_motion: r.value.reducedMotionOverride,
    });

    const db = await loadSupabaseDb(userContext);
    return { ok: true, value: db.settings };
  }

  return mutateLocal((draft) => {
    const r = validateSettingsInput(input);
    if (!r.ok) return fromDomain(r);
    draft.settings = { ...draft.settings, ...r.value };
    return { ok: true, value: draft.settings };
  });
}
