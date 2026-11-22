/* Direct Supabase Database & Authentication Engine for Bizora with Deterministic Financial Calculations */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import {
  SAMPLE_DATA,
  type Client,
  type Expense,
  type Invoice,
  type Notification,
  type Payment,
  type PaymentMethod,
  type Settings,
  type Shoot,
} from '../data/sampleData';
import { supabase } from '../utils/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  apiCreateClient,
  apiCreateExpense,
  apiCreateInvoice,
  apiDeleteClient,
  apiDeleteExpense,
  apiDeleteInvoice,
  apiRecordPayment,
  apiSendInvoice,
  apiUpdateClient,
  apiUpdateExpense,
  apiUpdateInvoice,
  apiUpdateSettings,
} from './api';

export interface StoreState {
  clients: Client[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  shoots: Shoot[];
  settings: Settings;
  notifications: Notification[];
}

export type StoreAction =
  | { type: 'addClient'; client: Omit<Client, 'id'> & { id?: string } }
  | { type: 'updateClient'; client: Client }
  | { type: 'deleteClient'; id: string }
  | { type: 'addInvoice'; invoice: Omit<Invoice, 'id' | 'number'> & { id?: string; number?: string } }
  | { type: 'updateInvoice'; invoice: Invoice }
  | { type: 'deleteInvoice'; id: string }
  | { type: 'sendInvoice'; id: string }
  | { type: 'recordPayment'; invoiceId: string; amount: number; method: PaymentMethod; date: string; id?: string }
  | { type: 'addExpense'; expense: Omit<Expense, 'id'> & { id?: string } }
  | { type: 'updateExpense'; expense: Expense }
  | { type: 'deleteExpense'; id: string }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'syncFromRemote'; payload: StoreState }
  | { type: 'resetToDemo' };

export interface ForecastPoint {
  month: string;
  actual?: number;
  forecast: number;
  low: number;
  high: number;
}

const MONTHS: readonly string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Helper to generate standard UUIDs compatible with Supabase PostgreSQL */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ---------- helpers ---------- */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function isPositiveAmount(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthSlots(count: number, startOffset: number): { key: string; label: string }[] {
  const now = new Date();
  const slots: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + startOffset + i, 1);
    slots.push({ key: keyOf(d), label: `${MONTHS[d.getMonth()] ?? ''} ${String(d.getFullYear()).slice(-2)}` });
  }
  return slots;
}

function sumByMonth<T>(items: readonly T[], dateOf: (item: T) => string, amountOf: (item: T) => number): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = dateOf(item).slice(0, 7); // YYYY-MM
    map.set(key, (map.get(key) ?? 0) + amountOf(item));
  }
  return map;
}

/* ---------- invoice math ---------- */

export function invoiceTotals(invoice: Invoice): { subtotal: number; tax: number; total: number } {
  if (!invoice) return { subtotal: 0, tax: 0, total: 0 };
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const taxRate = Number(invoice.taxRate) || 0;
  const subtotal = round2(
    items.reduce((sum, li) => sum + (Number(li?.quantity) || 0) * (Number(li?.rate) || 0), 0),
  );
  const tax = round2((subtotal * taxRate) / 100);
  const total = round2(subtotal + tax);
  return { subtotal, tax, total };
}

export function invoiceBalance(invoice: Invoice, payments: readonly Payment[]): number {
  if (!invoice) return 0;
  const paymentList = Array.isArray(payments) ? payments : [];
  const paid = paymentList
    .filter((p) => p && p.invoiceId === invoice.id)
    .reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
  return Math.max(0, round2(invoiceTotals(invoice).total - paid));
}

export function validatePayment(invoice: Invoice, payments: readonly Payment[], amount: number): string | null {
  if (!isPositiveAmount(amount)) {
    return 'Amount must be a number greater than zero';
  }
  const balance = invoiceBalance(invoice, payments);
  if (round2(amount) > balance) {
    return `Amount cannot exceed the outstanding balance of $${balance.toFixed(2)}`;
  }
  return null;
}

/* ---------- monthly aggregates ---------- */

export function monthlyRevenue(payments: readonly Payment[], months: number): { month: string; amount: number }[] {
  const byMonth = sumByMonth(payments, (p) => p.date, (p) => p.amount);
  return monthSlots(Math.max(0, months), 1 - months).map((s) => ({
    month: s.label,
    amount: round2(byMonth.get(s.key) ?? 0),
  }));
}

export function monthlyExpenses(expenses: readonly Expense[], months: number): { month: string; amount: number }[] {
  const byMonth = sumByMonth(expenses, (e) => e.date, (e) => e.amount);
  return monthSlots(Math.max(0, months), 1 - months).map((s) => ({
    month: s.label,
    amount: round2(byMonth.get(s.key) ?? 0),
  }));
}

export function forecast(
  months: number,
  growthPct: number,
  invoices: readonly Invoice[],
  expenses: readonly Expense[],
): ForecastPoint[] {
  const count = Math.max(0, Math.floor(months));
  if (count < 1) return [];

  const billed = sumByMonth(
    invoices.filter((i) => i.status !== 'Draft'),
    (i) => i.issueDate,
    (i) => invoiceTotals(i).total,
  );
  const spent = sumByMonth(expenses, (e) => e.date, (e) => e.amount);
  const netFor = (key: string): number => round2((billed.get(key) ?? 0) - (spent.get(key) ?? 0));

  const past = monthSlots(count, 1 - count).map((s) => ({ label: s.label, value: netFor(s.key) }));
  const avgNet = past.reduce((sum, p) => sum + p.value, 0) / (past.length || 1);

  const history: ForecastPoint[] = past.map((p) => ({
    month: p.label,
    actual: p.value,
    forecast: p.value,
    low: p.value,
    high: p.value,
  }));

  const projected: ForecastPoint[] = monthSlots(count, 1).map((s, idx) => {
    const value = round2(avgNet * Math.pow(1 + growthPct / 100, idx + 1));
    return {
      month: s.label,
      forecast: value,
      low: round2(value * 0.85),
      high: round2(value * 1.15),
    };
  });

  return [...history, ...projected];
}

/* ---------- reducer ---------- */

function reducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'syncFromRemote':
      return action.payload;

    case 'resetToDemo':
      return SAMPLE_DATA;

    case 'addClient': {
      if (action.client.name.trim() === '') return state;
      const client: Client = {
        ...action.client,
        id: action.client.id || generateUuid(),
      };
      return { ...state, clients: [...state.clients, client] };
    }

    case 'updateClient': {
      if (action.client.name.trim() === '') return state;
      if (!state.clients.some((c) => c.id === action.client.id)) return state;
      return {
        ...state,
        clients: state.clients.map((c) => (c.id === action.client.id ? action.client : c)),
      };
    }

    case 'deleteClient':
      return {
        ...state,
        clients: state.clients.filter((c) => c.id !== action.id),
      };

    case 'addInvoice': {
      if (!state.clients.some((c) => c.id === action.invoice.clientId)) return state;
      if (action.invoice.taxRate < 0 || action.invoice.taxRate > 100) return state;
      const number = action.invoice.number || `${state.settings.invoicePrefix}${state.settings.nextInvoiceNumber}`;
      const invoice: Invoice = {
        ...action.invoice,
        id: action.invoice.id || generateUuid(),
        number,
      };
      return {
        ...state,
        invoices: [...state.invoices, invoice],
        settings: { ...state.settings, nextInvoiceNumber: state.settings.nextInvoiceNumber + 1 },
      };
    }

    case 'updateInvoice': {
      if (!state.invoices.some((i) => i.id === action.invoice.id)) return state;
      if (action.invoice.taxRate < 0 || action.invoice.taxRate > 100) return state;
      return {
        ...state,
        invoices: state.invoices.map((i) => (i.id === action.invoice.id ? action.invoice : i)),
      };
    }

    case 'deleteInvoice':
      return {
        ...state,
        invoices: state.invoices.filter((i) => i.id !== action.id),
      };

    case 'sendInvoice': {
      if (!state.invoices.some((i) => i.id === action.id)) return state;
      return {
        ...state,
        invoices: state.invoices.map((i) => (i.id === action.id ? { ...i, status: 'Sent' } : i)),
      };
    }

    case 'recordPayment': {
      const invoice = state.invoices.find((i) => i.id === action.invoiceId);
      if (!invoice) return state;
      if (validatePayment(invoice, state.payments, action.amount) !== null) return state;

      const payment: Payment = {
        id: action.id || generateUuid(),
        invoiceId: invoice.id,
        amount: round2(action.amount),
        date: action.date,
        method: action.method,
      };
      const payments = [...state.payments, payment];
      const balance = invoiceBalance(invoice, payments);
      const status: Invoice['status'] = balance === 0 ? 'Paid' : 'Partially paid';

      return {
        ...state,
        payments,
        invoices: state.invoices.map((i) => (i.id === invoice.id ? { ...i, status } : i)),
      };
    }

    case 'addExpense': {
      if (!isPositiveAmount(action.expense.amount)) return state;
      const expense: Expense = {
        ...action.expense,
        id: action.expense.id || generateUuid(),
      };
      return { ...state, expenses: [...state.expenses, expense] };
    }

    case 'updateExpense': {
      if (!state.expenses.some((e) => e.id === action.expense.id)) return state;
      return {
        ...state,
        expenses: state.expenses.map((e) => (e.id === action.expense.id ? action.expense : e)),
      };
    }

    case 'deleteExpense':
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.id),
      };

    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    default:
      return state;
  }
}

/* ---------- Supabase Database Sync Engine ---------- */

async function fetchSupabaseState(userId: string): Promise<StoreState | null> {
  try {
    const [clientsRes, invoicesRes, paymentsRes, expensesRes, settingsRes, shootsRes, notifsRes] =
      await Promise.allSettled([
        supabase.from('clients').select('*').eq('user_id', userId),
        supabase.from('invoices').select('*, invoice_items(*)').eq('user_id', userId),
        supabase.from('payments').select('*').eq('user_id', userId),
        supabase.from('expenses').select('*').eq('user_id', userId),
        supabase.from('business_settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('shoots').select('*').eq('user_id', userId),
        supabase.from('notifications').select('*').eq('user_id', userId),
      ]);

    const clientsData = clientsRes.status === 'fulfilled' && !clientsRes.value.error ? clientsRes.value.data : null;
    const invoicesData = invoicesRes.status === 'fulfilled' && !invoicesRes.value.error ? invoicesRes.value.data : null;

    if (!clientsData && !invoicesData) {
      return null;
    }

    const paymentsData = paymentsRes.status === 'fulfilled' && !paymentsRes.value.error ? paymentsRes.value.data : [];
    const expensesData = expensesRes.status === 'fulfilled' && !expensesRes.value.error ? expensesRes.value.data : [];
    const settingsData = settingsRes.status === 'fulfilled' && !settingsRes.value.error ? settingsRes.value.data : null;
    const shootsData = shootsRes.status === 'fulfilled' && !shootsRes.value.error ? shootsRes.value.data : [];
    const notifsData = notifsRes.status === 'fulfilled' && !notifsRes.value.error ? notifsRes.value.data : [];

    const invoices: Invoice[] = (invoicesData || []).map((row: any) => ({
      id: row.id,
      number: row.number,
      clientId: row.client_id,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      status: row.status as Invoice['status'],
      taxRate: Number(row.tax_rate) || 0,
      notes: row.notes || '',
      items: (row.invoice_items || []).map((it: any) => ({
        id: it.id,
        description: it.description,
        quantity: Number(it.quantity) || 1,
        rate: Number(it.rate) || 0,
      })),
    }));

    const clients: Client[] = (clientsData || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      company: row.company || '',
      email: row.email,
      phone: row.phone || '',
      address: row.address || '',
    }));

    const payments: Payment[] = (paymentsData || []).map((row: any) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      amount: Number(row.amount) || 0,
      date: row.date,
      method: row.method,
    }));

    const expenses: Expense[] = (expensesData || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      category: row.category,
      vendor: row.vendor,
      amount: Number(row.amount) || 0,
      receipt: row.receipt || undefined,
    }));

    const shoots: Shoot[] = (shootsData || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      date: row.date,
      clientId: row.client_id || '',
      location: row.location || '',
    }));

    const notifications: Notification[] = (notifsData || []).map((row: any) => ({
      id: row.id,
      text: row.text,
      date: row.date,
      read: Boolean(row.read),
    }));

    const settings: Settings = {
      businessName: settingsData?.business_name || SAMPLE_DATA.settings.businessName,
      address: settingsData?.address || SAMPLE_DATA.settings.address,
      taxNumber: settingsData?.tax_number || SAMPLE_DATA.settings.taxNumber,
      currency: settingsData?.currency || SAMPLE_DATA.settings.currency,
      invoicePrefix: settingsData?.invoice_prefix || SAMPLE_DATA.settings.invoicePrefix,
      nextInvoiceNumber: settingsData?.next_invoice_number || SAMPLE_DATA.settings.nextInvoiceNumber,
      paymentTermsDays: settingsData?.payment_terms_days ?? SAMPLE_DATA.settings.paymentTermsDays,
      defaultTaxRate: settingsData?.default_tax_rate ?? SAMPLE_DATA.settings.defaultTaxRate,
      notifyPaymentReceived: settingsData?.email_notifications ?? SAMPLE_DATA.settings.notifyPaymentReceived,
      notifyOverdue: settingsData?.payment_alerts ?? SAMPLE_DATA.settings.notifyOverdue,
      notifyShootReminders: SAMPLE_DATA.settings.notifyShootReminders,
      reducedMotionOverride: settingsData?.reduced_motion ?? SAMPLE_DATA.settings.reducedMotionOverride,
    };

    return {
      clients,
      invoices,
      payments,
      expenses,
      shoots,
      settings,
      notifications,
    };
  } catch (err) {
    console.error('fetchSupabaseState error:', err);
    return null;
  }
}

/* Seeds initial photography business data into Supabase if a user has an empty database */
async function seedUserSupabaseData(userId: string) {
  try {
    const c1Id = generateUuid();
    const c2Id = generateUuid();
    const c3Id = generateUuid();
    const c4Id = generateUuid();

    // Insert Clients
    await supabase.from('clients').insert([
      { id: c1Id, user_id: userId, name: 'Mara Lindqvist', company: 'Lindqvist & Co. Interiors', email: 'mara@lindqvist.test', phone: '+1 555 010 2201', address: '18 Alder Street, Portland, OR' },
      { id: c2Id, user_id: userId, name: 'Tomas Reyes', company: 'Reyes Architects', email: 'tomas@reyes-arch.test', phone: '+1 555 010 2202', address: '240 Canal Road, Seattle, WA' },
      { id: c3Id, user_id: userId, name: 'Priya Nair', company: 'Nair Hospitality Group', email: 'priya.nair@hospitality.test', phone: '+1 555 010 2203', address: '9 Harbor Plaza, San Diego, CA' },
      { id: c4Id, user_id: userId, name: 'Jonas Whitfield', company: 'Whitfield Outdoor Co.', email: 'jonas@whitfield.test', phone: '+1 555 010 2204', address: '77 Ridge Lane, Boise, ID' },
    ]);

    // Insert Invoices
    const inv1Id = generateUuid();
    const inv2Id = generateUuid();
    const inv3Id = generateUuid();

    await supabase.from('invoices').insert([
      { id: inv1Id, user_id: userId, client_id: c1Id, number: 'INV-1001', issue_date: '2026-11-01', due_date: '2026-11-18', status: 'Sent', tax_rate: 8.5, notes: 'Full Day Architectural Shoot' },
      { id: inv2Id, user_id: userId, client_id: c2Id, number: 'INV-1002', issue_date: '2026-10-15', due_date: '2026-10-29', status: 'Partially paid', tax_rate: 8.5, notes: 'Commercial Portrait & Studio Session' },
      { id: inv3Id, user_id: userId, client_id: c3Id, number: 'INV-1003', issue_date: '2026-10-01', due_date: '2026-10-15', status: 'Paid', tax_rate: 8.5, notes: 'Resort Brand & Marketing Coverage' },
    ]);

    // Insert Invoice Items
    await supabase.from('invoice_items').insert([
      { id: generateUuid(), invoice_id: inv1Id, description: 'Architectural Photography (Full Day)', quantity: 1, rate: 1800 },
      { id: generateUuid(), invoice_id: inv1Id, description: 'Post-Production & Retouching', quantity: 6, rate: 75 },
      { id: generateUuid(), invoice_id: inv2Id, description: 'Executive Studio Portraits (3 Looks)', quantity: 1, rate: 1200 },
      { id: generateUuid(), invoice_id: inv3Id, description: 'Hospitality Brand Feature Package', quantity: 1, rate: 2600 },
    ]);

    // Insert Payments
    await supabase.from('payments').insert([
      { id: generateUuid(), user_id: userId, invoice_id: inv2Id, amount: 650, date: '2026-10-20', method: 'Bank transfer', notes: 'Initial 50% retainer' },
      { id: generateUuid(), user_id: userId, invoice_id: inv3Id, amount: 2821, date: '2026-10-14', method: 'Card', notes: 'Full settlement' },
    ]);

    // Insert Expenses
    await supabase.from('expenses').insert([
      { id: generateUuid(), user_id: userId, category: 'Studio rent', vendor: 'Northwest Creative Lofts', amount: 2500, date: '2026-11-01' },
      { id: generateUuid(), user_id: userId, category: 'Gear', vendor: 'LensRentals Pro', amount: 450, date: '2026-11-04' },
      { id: generateUuid(), user_id: userId, category: 'Software', vendor: 'Adobe Creative Cloud', amount: 110.97, date: '2026-11-02' },
      { id: generateUuid(), user_id: userId, category: 'Insurance', vendor: 'Hill & Usher Photography Shield', amount: 350, date: '2026-11-05' },
    ]);

    // Insert Shoots
    await supabase.from('shoots').insert([
      { id: generateUuid(), user_id: userId, title: 'Architectural Interior Shoot', date: '2026-11-25', client_id: c1Id, location: 'Portland Heights, OR', status: 'Scheduled' },
      { id: generateUuid(), user_id: userId, title: 'Reyes Partner Portraits', date: '2026-11-28', client_id: c2Id, location: 'Seattle Studio A', status: 'Scheduled' },
    ]);
  } catch (err) {
    console.warn('Initial Supabase seeding note:', err);
  }
}

// Write mutations directly to Supabase PostgreSQL
async function persistToSupabase(action: StoreAction, userId: string) {
  try {
    switch (action.type) {
      case 'addClient': {
        await supabase.from('clients').insert({
          id: action.client.id,
          user_id: userId,
          name: action.client.name,
          company: action.client.company || '',
          email: action.client.email,
          phone: action.client.phone || '',
          address: action.client.address || '',
        });
        break;
      }
      case 'updateClient': {
        await supabase
          .from('clients')
          .update({
            name: action.client.name,
            company: action.client.company || '',
            email: action.client.email,
            phone: action.client.phone || '',
            address: action.client.address || '',
          })
          .eq('id', action.client.id);
        break;
      }
      case 'deleteClient': {
        await supabase.from('clients').delete().eq('id', action.id);
        break;
      }
      case 'addInvoice': {
        await supabase.from('invoices').insert({
          id: action.invoice.id,
          user_id: userId,
          client_id: action.invoice.clientId,
          number: action.invoice.number,
          issue_date: action.invoice.issueDate,
          due_date: action.invoice.dueDate,
          status: action.invoice.status,
          tax_rate: action.invoice.taxRate,
          notes: action.invoice.notes || '',
        });
        if (action.invoice.items && action.invoice.items.length > 0) {
          const itemsPayload = action.invoice.items.map((it) => ({
            id: it.id && it.id.includes('-') && it.id.length > 20 ? it.id : generateUuid(),
            invoice_id: action.invoice.id,
            description: it.description,
            quantity: it.quantity,
            rate: it.rate,
          }));
          await supabase.from('invoice_items').insert(itemsPayload);
        }
        break;
      }
      case 'updateInvoice': {
        await supabase
          .from('invoices')
          .update({
            client_id: action.invoice.clientId,
            due_date: action.invoice.dueDate,
            tax_rate: action.invoice.taxRate,
            notes: action.invoice.notes || '',
            status: action.invoice.status,
          })
          .eq('id', action.invoice.id);
        break;
      }
      case 'deleteInvoice': {
        await supabase.from('invoices').delete().eq('id', action.id);
        break;
      }
      case 'sendInvoice': {
        await supabase.from('invoices').update({ status: 'Sent' }).eq('id', action.id);
        break;
      }
      case 'recordPayment': {
        const dbMethod = action.method === 'Card' ? 'Credit card' : action.method;
        await supabase.from('payments').insert({
          id: action.id,
          user_id: userId,
          invoice_id: action.invoiceId,
          amount: action.amount,
          date: action.date,
          method: dbMethod,
        });
        break;
      }
      case 'addExpense': {
        await supabase.from('expenses').insert({
          id: action.expense.id,
          user_id: userId,
          category: action.expense.category,
          vendor: action.expense.vendor,
          amount: action.expense.amount,
          date: action.expense.date,
          receipt: action.expense.receipt || '',
        });
        break;
      }
      case 'updateExpense': {
        await supabase
          .from('expenses')
          .update({
            category: action.expense.category,
            vendor: action.expense.vendor,
            amount: action.expense.amount,
            date: action.expense.date,
            receipt: action.expense.receipt || '',
          })
          .eq('id', action.expense.id)
          .eq('user_id', userId);
        break;
      }
      case 'deleteExpense': {
        await supabase
          .from('expenses')
          .delete()
          .eq('id', action.id)
          .eq('user_id', userId);
        break;
      }
      case 'updateSettings': {
        await supabase.from('business_settings').upsert({
          user_id: userId,
          currency: action.settings.currency,
          tax_number: action.settings.taxNumber,
          invoice_prefix: action.settings.invoicePrefix,
          next_invoice_number: action.settings.nextInvoiceNumber,
          payment_terms_days: action.settings.paymentTermsDays,
          default_tax_rate: action.settings.defaultTaxRate,
          email_notifications: action.settings.notifyPaymentReceived,
          payment_alerts: action.settings.notifyOverdue,
          reduced_motion: action.settings.reducedMotionOverride,
        });
        break;
      }
    }
  } catch (err) {
    console.error('Supabase persistence error:', err);
  }
}

/* ---------- provider & hook ---------- */

interface StoreContextValue {
  state: StoreState;
  dispatch: Dispatch<StoreAction>;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function getInitialState(storageKey: string): StoreState {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return SAMPLE_DATA;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = user ? `bizora_store_state_${user.id}` : 'bizora_store_state_anonymous';

  const [state, baseDispatch] = useReducer(reducer, storageKey, getInitialState);

  // Sync state to local storage on any state change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, storageKey]);

  // Primary loader: Supabase Database
  const syncRemote = useCallback(async () => {
    if (!user) return;

    let remote = await fetchSupabaseState(user.id);

    // If new user account with zero records, seed starter studio data into Supabase
    if (remote && remote.clients.length === 0 && remote.invoices.length === 0) {
      await seedUserSupabaseData(user.id);
      remote = await fetchSupabaseState(user.id);
    }

    if (remote) {
      baseDispatch({ type: 'syncFromRemote', payload: remote });
    }
  }, [user]);

  useEffect(() => {
    syncRemote();
  }, [syncRemote]);

  // Intercept dispatch to persist to Supabase PostgreSQL (and Node backend in parallel)
  const dispatch: Dispatch<StoreAction> = useCallback(
    (action: StoreAction) => {
      // Assign valid UUIDs for all new records
      const clientUuid = generateUuid();
      const invUuid = generateUuid();
      const payUuid = generateUuid();
      const expUuid = generateUuid();

      if (action.type === 'addClient' && !action.client.id) {
        action = { ...action, client: { ...action.client, id: clientUuid } };
      } else if (action.type === 'addInvoice' && !action.invoice.id) {
        action = { ...action, invoice: { ...action.invoice, id: invUuid } };
      } else if (action.type === 'recordPayment' && !action.id) {
        action = { ...action, id: payUuid };
      } else if (action.type === 'addExpense' && !action.expense.id) {
        action = { ...action, expense: { ...action.expense, id: expUuid } };
      }

      // Optimistic instant UI update
      baseDispatch(action);

      // Async background sync with Supabase PostgreSQL
      if (user) {
        persistToSupabase(action, user.id);
      }

      // Async sync with Node.js backend
      (async () => {
        try {
          switch (action.type) {
            case 'addClient':
              await apiCreateClient(action.client);
              break;
            case 'updateClient':
              await apiUpdateClient(action.client.id, action.client);
              break;
            case 'deleteClient':
              await apiDeleteClient(action.id);
              break;
            case 'addInvoice':
              await apiCreateInvoice({
                clientId: action.invoice.clientId,
                issueDate: action.invoice.issueDate,
                dueDate: action.invoice.dueDate,
                taxRate: action.invoice.taxRate,
                notes: action.invoice.notes,
                items: action.invoice.items.map((it) => ({
                  description: it.description,
                  quantity: it.quantity,
                  rate: it.rate,
                })),
              });
              break;
            case 'updateInvoice':
              await apiUpdateInvoice(action.invoice.id, action.invoice);
              break;
            case 'deleteInvoice':
              await apiDeleteInvoice(action.id);
              break;
            case 'sendInvoice':
              await apiSendInvoice(action.id);
              break;
            case 'recordPayment':
              await apiRecordPayment(action.invoiceId, {
                amount: action.amount,
                date: action.date,
                method: action.method,
              });
              break;
            case 'addExpense':
              await apiCreateExpense(action.expense);
              break;
            case 'updateExpense':
              await apiUpdateExpense(action.expense.id, action.expense);
              break;
            case 'deleteExpense':
              await apiDeleteExpense(action.id);
              break;
            case 'updateSettings':
              await apiUpdateSettings(action.settings);
              break;
          }
        } catch {
          // Handled silently
        }
      })();
    },
    [user],
  );

  const value = useMemo<StoreContextValue>(
    () => ({ state, dispatch, refresh: syncRemote }),
    [state, dispatch, syncRemote],
  );

  return createElement(StoreContext.Provider, { value }, children);
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (ctx === null) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return ctx;
}

export function loadSample(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 150);
  });
}
