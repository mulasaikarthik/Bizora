// Client API service for Bizora Node.js backend & Supabase
import { supabase } from '../utils/supabase/client';
import type { Client, Expense, Invoice, Payment, PaymentMethod, Settings } from '../data/sampleData';

const BASE_URL = '/api';

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // Ignore error
  }
  return {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const authHeaders = await getAuthHeader();
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options.headers || {}),
      },
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        error: body?.error || `Request failed with status ${res.status}`,
      };
    }

    return { ok: true, data: body as T };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error connecting to backend' };
  }
}

// State & Summaries
export async function apiGetState() {
  return request<any>('/state');
}

export async function apiGetSummary() {
  return request<{
    revenueMonth: number;
    outstanding: number;
    overdue: { count: number; total: number };
    dueSoon: { count: number; total: number };
    expensesMonth: number;
    netCash: number;
  }>('/summary');
}

export async function apiGetForecast(horizon = 30, lateDays = 0) {
  return request<{
    horizon: number;
    lateDays: number;
    startingBalance: number;
    projectedCash: number;
    cashDelta: number;
    inflow: number;
    outflow: number;
    daily: Array<{ date: string; cash: number; inflow: number; outflow: number }>;
  }>(`/forecast?horizon=${horizon}&lateDays=${lateDays}`);
}

export async function apiGetReminders() {
  return request<Array<{
    invoiceId: string;
    number: string;
    clientName: string;
    dueDate: string;
    daysOverdue: number;
    balance: number;
    lastRemindedAt?: string;
  }>>('/reminders');
}

export async function apiSendReminder(invoiceId: string) {
  return request<any>(`/reminders/${invoiceId}/send`, { method: 'POST' });
}

// Clients
export async function apiGetClients() {
  return request<Client[]>('/clients');
}

export async function apiCreateClient(client: Omit<Client, 'id'>) {
  return request<Client>('/clients', {
    method: 'POST',
    body: JSON.stringify(client),
  });
}

export async function apiUpdateClient(id: string, client: Partial<Client>) {
  return request<Client>(`/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(client),
  });
}

export async function apiDeleteClient(id: string) {
  return request<{ id: string; deleted: boolean }>(`/clients/${id}`, {
    method: 'DELETE',
  });
}

// Invoices
export async function apiGetInvoices() {
  return request<Invoice[]>('/invoices');
}

export async function apiCreateInvoice(invoice: {
  clientId: string;
  issueDate: string;
  dueDate: string;
  taxRate: number;
  notes?: string;
  items: Array<{ description: string; quantity: number; rate: number }>;
}) {
  return request<Invoice>('/invoices', {
    method: 'POST',
    body: JSON.stringify(invoice),
  });
}

export async function apiUpdateInvoice(id: string, invoice: Partial<Invoice>) {
  return request<Invoice>(`/invoices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(invoice),
  });
}

export async function apiDeleteInvoice(id: string) {
  return request<{ id: string; deleted: boolean }>(`/invoices/${id}`, {
    method: 'DELETE',
  });
}

export async function apiSendInvoice(id: string) {
  return request<Invoice>(`/invoices/${id}/send`, {
    method: 'POST',
  });
}

// Payments
export async function apiRecordPayment(invoiceId: string, payment: {
  amount: number;
  date: string;
  method: PaymentMethod;
  notes?: string;
}) {
  return request<Payment>(`/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payment),
  });
}

// Expenses
export async function apiGetExpenses() {
  return request<Expense[]>('/expenses');
}

export async function apiCreateExpense(expense: Omit<Expense, 'id'>) {
  return request<Expense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(expense),
  });
}

export async function apiUpdateExpense(id: string, expense: Partial<Expense>) {
  return request<Expense>(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(expense),
  });
}

export async function apiDeleteExpense(id: string) {
  return request<{ id: string; deleted: boolean }>(`/expenses/${id}`, {
    method: 'DELETE',
  });
}

// Settings
export async function apiGetSettings() {
  return request<Settings>('/settings');
}

export async function apiUpdateSettings(settings: Partial<Settings>) {
  return request<Settings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
