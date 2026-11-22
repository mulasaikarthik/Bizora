// Business rules for Bizora. Pure functions only: no I/O, no npm packages.
// Money is handled internally as integer cents and returned as 2-decimal numbers.

const INVOICE_STATUSES = ['Draft', 'Sent', 'Partially paid', 'Paid', 'Overdue'];
const PAYMENT_METHODS = ['Bank transfer', 'Card', 'Cash', 'PayPal'];
const EXPENSE_CATEGORIES = ['Gear', 'Travel', 'Software', 'Studio rent', 'Marketing', 'Insurance'];
const EXPENSE_STATUSES = ['paid', 'scheduled'];
const CURRENCIES = ['USD', 'EUR', 'GBP'];

const DUE_SOON_DAYS = 14;
const REMINDER_WINDOW_DAYS = 7;
const BILL_WINDOW_DAYS = 30;
const MAX_QUANTITY = 100000;
const MS_PER_DAY = 86400000;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREFIX_RE = /^[A-Za-z0-9-]*$/;

const SETTINGS_KEYS = new Set([
  'businessName',
  'address',
  'taxNumber',
  'currency',
  'invoicePrefix',
  'paymentTermsDays',
  'defaultTaxRate',
  'notifyPaymentReceived',
  'notifyOverdue',
  'notifyShootReminders',
  'reducedMotionOverride',
]);

// ---------- internal helpers ----------

function pad(n) {
  return String(n).padStart(2, '0');
}

function isISODate(value) {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function utcMs(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

function centsToAmount(cents) {
  return Math.round(cents) / 100;
}

// Accepts numbers and numeric strings; anything else becomes NaN.
function toNumber(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '') return Number(raw);
  return NaN;
}

// Trims and length-checks text. Returns { value } or { error }.
function readText(raw, { min = 0, max, label }) {
  const text = raw === undefined || raw === null ? '' : raw;
  if (typeof text !== 'string') return { error: `${label} must be text` };
  const value = text.trim();
  if (value.length < min || value.length > max) {
    return { error: min === 0 ? `${label} must be at most ${max} characters` : `${label} must be ${min}-${max} characters` };
  }
  return { value };
}

function collect(fields, value, key, result) {
  if (result.error) fields[key] = result.error;
  else value[key] = result.value;
}

function finish(fields, value) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return { ok: true, value };
  return { ok: false, code: 'INVALID_INPUT', error: fields[keys[0]], fields };
}

function reject(code, error, fields = {}) {
  return { ok: false, code, error, fields };
}

function invoiceCents(invoice) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = items.reduce(
    (sum, it) => sum + Math.round(Number(it.quantity) * Number(it.rate) * 100),
    0,
  );
  const taxRate = Number(invoice.taxRate) || 0;
  const tax = Math.round((subtotal * taxRate) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

function paidCents(invoiceId, payments) {
  return (Array.isArray(payments) ? payments : []).reduce(
    (sum, p) => (p.invoiceId === invoiceId ? sum + toCents(p.amount) : sum),
    0,
  );
}

function balanceCents(invoice, payments) {
  return Math.max(0, invoiceCents(invoice).total - paidCents(invoice.id, payments));
}

function clientNameOf(clients, clientId) {
  const client = (Array.isArray(clients) ? clients : []).find((c) => c.id === clientId);
  return client ? client.name : 'Unknown client';
}

function lastReminderAt(reminders) {
  if (!Array.isArray(reminders) || reminders.length === 0) return null;
  const last = reminders[reminders.length - 1];
  if (typeof last === 'string') return last;
  if (isPlainObject(last)) return last.at ?? last.sentAt ?? null;
  return null;
}

function cashBalanceCents(payments, expenses) {
  const received = (Array.isArray(payments) ? payments : []).reduce((s, p) => s + toCents(p.amount), 0);
  const paid = (Array.isArray(expenses) ? expenses : [])
    .map(normaliseExpense)
    .filter((e) => e.status === 'paid')
    .reduce((s, e) => s + toCents(e.amount), 0);
  return received - paid;
}

// ---------- dates ----------

export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDaysISO(iso, days) {
  const d = new Date(utcMs(iso) + days * MS_PER_DAY);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function daysBetween(fromISO, toISO) {
  return Math.round((utcMs(toISO) - utcMs(fromISO)) / MS_PER_DAY);
}

// ---------- normalisation ----------

export function normaliseInvoice(stored) {
  return {
    ...stored,
    status: stored.status === 'Overdue' ? 'Sent' : stored.status,
    items: Array.isArray(stored.items) ? stored.items : [],
    notes: stored.notes ?? '',
    reminders: Array.isArray(stored.reminders) ? stored.reminders : [],
    sentAt: stored.sentAt ?? null,
  };
}

export function normaliseExpense(stored) {
  return {
    ...stored,
    status: stored.status === 'scheduled' ? 'scheduled' : 'paid',
    dueDate: stored.dueDate || null,
    receiptName: stored.receiptName || stored.receipt || null,
    notes: stored.notes ?? '',
  };
}

// ---------- money and status ----------

export function computeTotals(invoice) {
  const c = invoiceCents(invoice);
  return { subtotal: centsToAmount(c.subtotal), tax: centsToAmount(c.tax), total: centsToAmount(c.total) };
}

export function paidAmount(invoiceId, payments) {
  return centsToAmount(paidCents(invoiceId, payments));
}

export function balanceOf(invoice, payments) {
  return centsToAmount(balanceCents(invoice, payments));
}

export function effectiveStatus(invoice, payments, today) {
  const stored = invoice.status === 'Overdue' ? 'Sent' : invoice.status;
  if (stored === 'Draft') return 'Draft';
  const paid = paidCents(invoice.id, payments);
  const balance = balanceCents(invoice, payments);
  if (balance === 0 && (paid > 0 || stored === 'Paid')) return 'Paid';
  const base = paid > 0 ? 'Partially paid' : 'Sent';
  if (balance > 0 && isISODate(invoice.dueDate) && invoice.dueDate < today) return 'Overdue';
  return base;
}

export function decorateInvoice(invoice, payments, clients, today) {
  const inv = normaliseInvoice(invoice);
  const c = invoiceCents(inv);
  const paid = paidCents(inv.id, payments);
  const balance = balanceCents(inv, payments);
  const eff = effectiveStatus(inv, payments, today);
  return {
    ...inv,
    subtotal: centsToAmount(c.subtotal),
    tax: centsToAmount(c.tax),
    total: centsToAmount(c.total),
    paid: centsToAmount(paid),
    balance: centsToAmount(balance),
    effectiveStatus: eff,
    daysOverdue: eff === 'Overdue' ? daysBetween(inv.dueDate, today) : 0,
    clientName: clientNameOf(clients, inv.clientId),
  };
}

// ---------- validation ----------

export function validateClient(input) {
  if (!isPlainObject(input)) return reject('INVALID_INPUT', 'Client data must be an object', { form: 'Client data must be an object' });
  const fields = {};
  const value = {};
  collect(fields, value, 'name', readText(input.name, { min: 2, max: 120, label: 'Name' }));
  collect(fields, value, 'company', readText(input.company, { max: 200, label: 'Company' }));
  collect(fields, value, 'email', readText(input.email, { max: 200, label: 'Email' }));
  if (!fields.email && value.email && !EMAIL_RE.test(value.email)) fields.email = 'Email address is not valid';
  collect(fields, value, 'phone', readText(input.phone, { max: 200, label: 'Phone' }));
  collect(fields, value, 'address', readText(input.address, { max: 200, label: 'Address' }));
  collect(fields, value, 'notes', readText(input.notes, { max: 2000, label: 'Notes' }));
  return finish(fields, value);
}

function changesLockedFields(existing, value) {
  const prev = normaliseInvoice(existing);
  if (prev.clientId !== value.clientId) return true;
  if (prev.issueDate !== value.issueDate) return true;
  if (Number(prev.taxRate ?? 0) !== value.taxRate) return true;
  if (prev.items.length !== value.items.length) return true;
  return prev.items.some((p, i) => {
    const n = value.items[i];
    return p.description !== n.description || Number(p.quantity) !== n.quantity || Number(p.rate) !== n.rate;
  });
}

// options.existing: the stored invoice being edited (omit when creating).
// options.payments: all stored payments; used to decide whether the edit is locked.
export function validateInvoiceInput(input, { clients = [], settings = {}, existing = null, payments = [] } = {}) {
  if (!isPlainObject(input)) return reject('INVALID_INPUT', 'Invoice data must be an object', { form: 'Invoice data must be an object' });
  const fields = {};
  const value = {};

  const clientId = typeof input.clientId === 'string' ? input.clientId : '';
  if (clientId && clients.some((c) => c.id === clientId)) value.clientId = clientId;
  else fields.clientId = 'Choose an existing client';

  if (isISODate(input.issueDate)) value.issueDate = input.issueDate;
  else fields.issueDate = 'Issue date must be a valid date';
  if (isISODate(input.dueDate)) value.dueDate = input.dueDate;
  else fields.dueDate = 'Due date must be a valid date';
  if (value.issueDate && value.dueDate && value.dueDate < value.issueDate) {
    fields.dueDate = 'Due date cannot be before the issue date';
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    fields.items = 'Add at least one line item';
  } else {
    const lines = [];
    let lineError = null;
    input.items.forEach((it, i) => {
      if (lineError) return;
      if (!isPlainObject(it)) {
        lineError = `Line ${i + 1} is invalid`;
        return;
      }
      const description = readText(it.description, { min: 1, max: 500, label: 'Description' });
      if (description.error) {
        lineError = `Line ${i + 1}: ${description.error}`;
        return;
      }
      const quantity = toNumber(it.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
        lineError = `Line ${i + 1}: quantity must be greater than 0 and at most ${MAX_QUANTITY}`;
        return;
      }
      const rate = toNumber(it.rate);
      if (!Number.isFinite(rate) || rate < 0) {
        lineError = `Line ${i + 1}: rate must be 0 or more`;
        return;
      }
      lines.push({
        id: typeof it.id === 'string' && it.id ? it.id : null,
        description: description.value,
        quantity,
        rate,
      });
    });
    if (lineError) fields.items = lineError;
    else value.items = lines;
  }

  const rawTax = input.taxRate === undefined || input.taxRate === null ? settings.defaultTaxRate ?? 0 : input.taxRate;
  const taxRate = toNumber(rawTax);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) fields.taxRate = 'Tax rate must be between 0 and 100';
  else value.taxRate = taxRate;

  collect(fields, value, 'notes', readText(input.notes, { max: 2000, label: 'Notes' }));

  const result = finish(fields, value);
  if (!result.ok) return result;

  if (existing && payments.some((p) => p.invoiceId === existing.id) && changesLockedFields(existing, value)) {
    return {
      ok: false,
      code: 'LOCKED_BY_PAYMENTS',
      error: 'This invoice has payments, so its client, issue date, items and tax rate are locked',
    };
  }
  return result;
}

// options.invoice: the invoice being paid; options.payments: all stored payments; options.today: ISO date.
export function validatePaymentInput(input, { invoice, payments = [], today }) {
  if (!invoice) return reject('NOT_FOUND', 'Invoice not found');
  if (!isPlainObject(input)) return reject('INVALID_INPUT', 'Payment data must be an object', { form: 'Payment data must be an object' });

  const inv = normaliseInvoice(invoice);
  if (effectiveStatus(inv, payments, today) === 'Draft') {
    return reject('DRAFT_INVOICE', 'Send the invoice before recording a payment');
  }

  const amount = toNumber(input.amount);
  const amountCents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - amountCents) > 1e-6) {
    return reject('INVALID_INPUT', 'Amount must be greater than zero with at most 2 decimals', {
      amount: 'Amount must be greater than zero with at most 2 decimals',
    });
  }

  const balance = balanceCents(inv, payments);
  if (amountCents > balance) {
    return reject('EXCEEDS_BALANCE', `Amount cannot exceed the outstanding balance of ${(balance / 100).toFixed(2)}`);
  }

  const fields = {};
  if (!PAYMENT_METHODS.includes(input.method)) fields.method = 'Choose a valid payment method';
  if (!isISODate(input.date)) fields.date = 'Payment date must be a valid date';
  else if (input.date > addDaysISO(today, 1)) fields.date = 'Payment date cannot be in the future';

  if (Object.keys(fields).length) return reject('INVALID_INPUT', Object.values(fields)[0], fields);
  return { ok: true, value: { invoiceId: inv.id, amount: amountCents / 100, method: input.method, date: input.date } };
}

export function validateExpenseInput(input) {
  if (!isPlainObject(input)) return reject('INVALID_INPUT', 'Expense data must be an object', { form: 'Expense data must be an object' });
  const fields = {};
  const value = {};

  collect(fields, value, 'vendor', readText(input.vendor, { min: 1, max: 120, label: 'Vendor' }));

  if (EXPENSE_CATEGORIES.includes(input.category)) value.category = input.category;
  else fields.category = 'Choose a valid category';

  const amount = toNumber(input.amount);
  if (Number.isFinite(amount) && amount > 0) value.amount = Math.round(amount * 100) / 100;
  else fields.amount = 'Amount must be greater than zero';

  if (isISODate(input.date)) value.date = input.date;
  else fields.date = 'Date must be a valid date';

  const status = input.status === undefined || input.status === null || input.status === '' ? 'paid' : input.status;
  if (EXPENSE_STATUSES.includes(status)) value.status = status;
  else fields.status = 'Status must be paid or scheduled';

  const dueDate = input.dueDate === undefined || input.dueDate === null || input.dueDate === '' ? null : input.dueDate;
  if (status === 'scheduled' && !isISODate(dueDate)) fields.dueDate = 'Scheduled bills need a valid due date';
  else if (dueDate !== null && !isISODate(dueDate)) fields.dueDate = 'Due date must be a valid date';
  else value.dueDate = dueDate;

  collect(fields, value, 'receiptName', readText(input.receiptName, { max: 255, label: 'Receipt name' }));
  if (value.receiptName === '') value.receiptName = null;

  collect(fields, value, 'notes', readText(input.notes, { max: 2000, label: 'Notes' }));

  return finish(fields, value);
}

function booleanCheck(raw) {
  return typeof raw === 'boolean' ? { value: raw } : { error: 'Must be true or false' };
}

const SETTING_CHECKS = {
  businessName: (raw) => readText(raw, { min: 1, max: 120, label: 'Business name' }),
  address: (raw) => readText(raw, { max: 200, label: 'Address' }),
  taxNumber: (raw) => readText(raw, { max: 200, label: 'Tax number' }),
  currency: (raw) => (CURRENCIES.includes(raw) ? { value: raw } : { error: 'Currency must be USD, EUR or GBP' }),
  invoicePrefix: (raw) => {
    const r = readText(raw, { min: 1, max: 10, label: 'Invoice prefix' });
    if (r.error) return r;
    return PREFIX_RE.test(r.value) ? r : { error: 'Invoice prefix may only contain letters, digits and hyphens' };
  },
  paymentTermsDays: (raw) =>
    Number.isInteger(raw) && raw >= 0 && raw <= 365 ? { value: raw } : { error: 'Payment terms must be a whole number of days from 0 to 365' },
  defaultTaxRate: (raw) =>
    typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 100
      ? { value: raw }
      : { error: 'Default tax rate must be between 0 and 100' },
  notifyPaymentReceived: booleanCheck,
  notifyOverdue: booleanCheck,
  notifyShootReminders: booleanCheck,
  reducedMotionOverride: booleanCheck,
};

// Partial updates allowed: only keys present (not undefined) are checked and returned.
export function validateSettingsInput(input) {
  if (!isPlainObject(input)) return reject('INVALID_INPUT', 'Settings must be an object', { form: 'Settings must be an object' });
  const fields = {};
  const value = {};
  for (const key of Object.keys(input)) {
    const raw = input[key];
    if (!SETTINGS_KEYS.has(key)) {
      fields[key] = 'Unknown setting';
      continue;
    }
    if (raw === undefined) continue;
    collect(fields, value, key, SETTING_CHECKS[key](raw));
  }
  return finish(fields, value);
}

// ---------- delete / send / remind rules ----------

export function canDeleteClient(clientId, invoices = []) {
  if (invoices.some((inv) => inv.clientId === clientId)) {
    return reject('HAS_INVOICES', 'This client has invoices and cannot be deleted');
  }
  return { ok: true };
}

export function canDeleteInvoice(invoice, payments = []) {
  if (normaliseInvoice(invoice).status !== 'Draft') return reject('NOT_DRAFT', 'Only draft invoices can be deleted');
  if (payments.some((p) => p.invoiceId === invoice.id)) return reject('HAS_PAYMENTS', 'This invoice has payments and cannot be deleted');
  return { ok: true };
}

export function canSendInvoice(invoice) {
  if (normaliseInvoice(invoice).status !== 'Draft') return reject('NOT_DRAFT', 'Only draft invoices can be sent');
  const hasItem = (Array.isArray(invoice.items) ? invoice.items : []).some((it) => Number(it.quantity) > 0);
  if (!hasItem) return reject('NO_ITEMS', 'Add at least one line item with a quantity before sending');
  return { ok: true };
}

export function canRemind(invoice, payments, today) {
  const eff = effectiveStatus(normaliseInvoice(invoice), payments, today);
  const remindable = eff === 'Sent' || eff === 'Partially paid' || eff === 'Overdue';
  if (remindable && balanceCents(invoice, payments) > 0) return { ok: true };
  return reject('NOT_REMINDABLE', 'Only unpaid sent invoices can be reminded');
}

// ---------- summary, reminders, forecast ----------

export function buildSummary({ invoices = [], payments = [], expenses = [], today }) {
  const month = today.slice(0, 7);
  const rows = invoices.map(normaliseInvoice).map((inv) => ({
    inv,
    eff: effectiveStatus(inv, payments, today),
    bal: balanceCents(inv, payments),
  }));

  let outstanding = 0;
  let overdueCount = 0;
  let overdueTotal = 0;
  let dueSoonCount = 0;
  let dueSoonTotal = 0;
  const soonLimit = addDaysISO(today, DUE_SOON_DAYS);
  for (const r of rows) {
    if (r.inv.status === 'Draft' || r.inv.status === 'Paid') continue;
    outstanding += r.bal;
    if (r.bal <= 0) continue;
    if (r.eff === 'Overdue') {
      overdueCount += 1;
      overdueTotal += r.bal;
    } else if (isISODate(r.inv.dueDate) && r.inv.dueDate >= today && r.inv.dueDate <= soonLimit) {
      dueSoonCount += 1;
      dueSoonTotal += r.bal;
    }
  }

  const received = Array.isArray(payments) ? payments : [];
  const exps = expenses.map(normaliseExpense);
  const paidExp = exps.filter((e) => e.status === 'paid');

  const revenueMonthCents = received
    .filter((p) => String(p.date).startsWith(month))
    .reduce((s, p) => s + toCents(p.amount), 0);
  const expensesMonthCents = paidExp
    .filter((e) => String(e.date).startsWith(month))
    .reduce((s, e) => s + toCents(e.amount), 0);

  const billLimit = addDaysISO(today, BILL_WINDOW_DAYS);
  const bills = exps.filter((e) => e.status === 'scheduled' && isISODate(e.dueDate) && e.dueDate <= billLimit);
  const billsTotalCents = bills.reduce((s, e) => s + toCents(e.amount), 0);

  const cutoff = addDaysISO(today, -365);
  const categoryTotals = [];
  for (const category of EXPENSE_CATEGORIES) {
    const cents = paidExp
      .filter((e) => e.category === category && e.date >= cutoff)
      .reduce((s, e) => s + toCents(e.amount), 0);
    if (cents !== 0) categoryTotals.push({ category, total: centsToAmount(cents) });
  }

  return {
    revenueMonth: centsToAmount(revenueMonthCents),
    outstanding: centsToAmount(outstanding),
    overdue: { count: overdueCount, total: centsToAmount(overdueTotal) },
    dueSoon: { count: dueSoonCount, total: centsToAmount(dueSoonTotal) },
    expensesMonth: centsToAmount(expensesMonthCents),
    upcomingBills: { count: bills.length, total: centsToAmount(billsTotalCents) },
    netCashMonth: centsToAmount(revenueMonthCents - expensesMonthCents),
    cashBalance: centsToAmount(cashBalanceCents(payments, expenses)),
    categoryTotals,
  };
}

export function buildReminders({ invoices = [], payments = [], clients = [], today }) {
  const limit = addDaysISO(today, REMINDER_WINDOW_DAYS);
  const rows = [];
  for (const raw of invoices) {
    const inv = normaliseInvoice(raw);
    if (inv.status === 'Draft' || inv.status === 'Paid') continue;
    const bal = balanceCents(inv, payments);
    if (bal <= 0 || !isISODate(inv.dueDate)) continue;
    const eff = effectiveStatus(inv, payments, today);
    let kind;
    if (eff === 'Overdue') kind = 'overdue';
    else if (inv.dueDate >= today && inv.dueDate <= limit) kind = 'due-soon';
    else continue;
    rows.push({
      invoiceId: inv.id,
      number: inv.number,
      clientName: clientNameOf(clients, inv.clientId),
      balance: centsToAmount(bal),
      dueDate: inv.dueDate,
      daysOverdue: kind === 'overdue' ? daysBetween(inv.dueDate, today) : 0,
      kind,
      lastReminderAt: lastReminderAt(inv.reminders),
    });
  }
  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'overdue' ? -1 : 1;
    if (a.dueDate < b.dueDate) return -1;
    return a.dueDate > b.dueDate ? 1 : 0;
  });
  return rows;
}

// lateDays shifts every invoice receipt date forward; the scenario reports what that pushes past the horizon.
export function buildForecast({ invoices = [], payments = [], expenses = [], today, horizon = 30, lateDays = 0 }) {
  if (![30, 60, 90].includes(horizon)) throw new RangeError('horizon must be 30, 60 or 90');
  if (!Number.isInteger(lateDays) || lateDays < 0 || lateDays > 60) {
    throw new RangeError('lateDays must be an integer from 0 to 60');
  }
  const end = addDaysISO(today, horizon);
  const openingCents = cashBalanceCents(payments, expenses);

  const inflowItems = [];
  for (const raw of invoices) {
    const inv = normaliseInvoice(raw);
    if (inv.status === 'Draft' || inv.status === 'Paid') continue;
    const bal = balanceCents(inv, payments);
    if (bal <= 0) continue;
    const eff = effectiveStatus(inv, payments, today);
    const date = eff === 'Overdue' ? today : inv.dueDate;
    if (!isISODate(date) || date > end) continue;
    inflowItems.push({ kind: 'invoice', id: inv.id, label: inv.number, date, amountCents: bal });
  }

  const outflowItems = [];
  for (const raw of expenses) {
    const e = normaliseExpense(raw);
    if (e.status !== 'scheduled' || !isISODate(e.dueDate)) continue;
    const date = e.dueDate < today ? today : e.dueDate;
    if (date > end) continue;
    outflowItems.push({ kind: 'bill', id: e.id, label: e.vendor, date, amountCents: toCents(e.amount) });
  }

  const bucketCount = Math.ceil(horizon / 7);

  function runScenario(shiftDays) {
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      label: `Wk ${i + 1}`,
      start: addDaysISO(today, i * 7),
      inflow: 0,
      outflow: 0,
    }));
    let inflow = 0;
    let outflow = 0;
    let pushedOutCount = 0;
    let pushedOutCents = 0;

    for (const it of inflowItems) {
      const date = shiftDays ? addDaysISO(it.date, shiftDays) : it.date;
      const offset = daysBetween(today, date);
      if (offset > horizon) {
        pushedOutCount += 1;
        pushedOutCents += it.amountCents;
        continue;
      }
      const idx = Math.max(0, Math.floor(offset / 7));
      buckets[idx].inflow += it.amountCents;
      inflow += it.amountCents;
    }
    for (const it of outflowItems) {
      const idx = Math.max(0, Math.floor(daysBetween(today, it.date) / 7));
      buckets[idx].outflow += it.amountCents;
      outflow += it.amountCents;
    }

    let running = openingCents;
    let lowest = openingCents;
    const outBuckets = buckets.map((b) => {
      running += b.inflow - b.outflow;
      lowest = Math.min(lowest, running);
      return {
        label: b.label,
        start: b.start,
        inflow: centsToAmount(b.inflow),
        outflow: centsToAmount(b.outflow),
        closing: centsToAmount(running),
      };
    });

    return {
      openingBalance: centsToAmount(openingCents),
      inflows: centsToAmount(inflow),
      outflows: centsToAmount(outflow),
      endingBalance: centsToAmount(openingCents + inflow - outflow),
      lowestBalance: centsToAmount(lowest),
      buckets: outBuckets,
      pushedOutCount,
      pushedOutAmount: centsToAmount(pushedOutCents),
    };
  }

  const items = [...inflowItems, ...outflowItems]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((it) => ({ kind: it.kind, id: it.id, label: it.label, date: it.date, amount: centsToAmount(it.amountCents) }));

  return {
    horizonDays: horizon,
    lateDays,
    baseline: runScenario(0),
    scenario: runScenario(lateDays),
    items,
  };
}
