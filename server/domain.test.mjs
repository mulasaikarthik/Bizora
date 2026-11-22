// Tests for the pure business rules in domain.mjs. Run with: node --test server
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  todayISO,
  addDaysISO,
  daysBetween,
  computeTotals,
  balanceOf,
  effectiveStatus,
  decorateInvoice,
  validateInvoiceInput,
  validatePaymentInput,
  validateSettingsInput,
  buildSummary,
  buildForecast,
  canDeleteClient,
  canDeleteInvoice,
} from './domain.mjs';

const TODAY = '2025-06-15';
const CLIENT = { id: 'cl-1', name: 'Mara Lindqvist' };

function invoice(overrides = {}) {
  return {
    id: 'inv-1',
    number: 'INV-1000',
    clientId: 'cl-1',
    issueDate: '2025-06-01',
    dueDate: '2025-07-01',
    status: 'Sent',
    taxRate: 8,
    notes: '',
    items: [{ id: 'i1', description: 'Shoot', quantity: 1, rate: 100 }],
    ...overrides,
  };
}

function payment(amount, overrides = {}) {
  return { id: `p-${amount}`, invoiceId: 'inv-1', amount, date: TODAY, method: 'Bank transfer', ...overrides };
}

test('date helpers use ISO days', () => {
  assert.equal(todayISO(new Date(2025, 5, 15, 12, 0, 0)), '2025-06-15');
  assert.equal(addDaysISO('2025-06-30', 1), '2025-07-01');
  assert.equal(daysBetween('2025-06-01', '2025-06-15'), 14);
});

test('totals apply 8% tax in cents', () => {
  const inv = invoice({
    items: [
      { id: 'a', description: 'Day rate', quantity: 2, rate: 100 },
      { id: 'b', description: 'Edit', quantity: 1, rate: 50.5 },
    ],
    taxRate: 8,
  });
  assert.deepEqual(computeTotals(inv), { subtotal: 250.5, tax: 20.04, total: 270.54 });
});

test('partial then full payment moves status to Paid', () => {
  const inv = invoice({ items: [{ id: 'a', description: 'Shoot', quantity: 1, rate: 100 }], taxRate: 0 });
  const afterPartial = [payment(40)];
  assert.equal(balanceOf(inv, afterPartial), 60);
  assert.equal(effectiveStatus(inv, afterPartial, TODAY), 'Partially paid');

  const afterFull = [payment(40), payment(60)];
  assert.equal(balanceOf(inv, afterFull), 0);
  assert.equal(effectiveStatus(inv, afterFull, TODAY), 'Paid');
});

test('overpayment is rejected with EXCEEDS_BALANCE', () => {
  const inv = invoice({ items: [{ id: 'a', description: 'Shoot', quantity: 1, rate: 100 }], taxRate: 0 });
  const result = validatePaymentInput(
    { amount: 100.01, method: 'Cash', date: TODAY },
    { invoice: inv, payments: [], today: TODAY },
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EXCEEDS_BALANCE');
  assert.match(result.error, /100\.00/);
});

test('payment against a Draft invoice is rejected', () => {
  const result = validatePaymentInput(
    { amount: 10, method: 'Card', date: TODAY },
    { invoice: invoice({ status: 'Draft' }), payments: [], today: TODAY },
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DRAFT_INVOICE');
});

test('overdue is derived from due date and balance', () => {
  const late = invoice({ status: 'Sent', dueDate: '2025-06-01' });
  assert.equal(effectiveStatus(late, [], TODAY), 'Overdue');
  assert.equal(decorateInvoice(late, [], [CLIENT], TODAY).daysOverdue, 14);

  const legacy = invoice({ status: 'Overdue', dueDate: '2025-06-01' });
  assert.equal(effectiveStatus(legacy, [], TODAY), 'Overdue');

  const legacyNotLate = invoice({ status: 'Overdue', dueDate: '2025-06-20' });
  assert.equal(effectiveStatus(legacyNotLate, [], TODAY), 'Sent');

  const notYetDue = invoice({ status: 'Sent', dueDate: '2025-06-15' });
  assert.equal(effectiveStatus(notYetDue, [], TODAY), 'Sent');
});

test('forecast late shift pushes an invoice out of a 30-day horizon', () => {
  // Due 20 days from today: inside a 30-day horizon as-is.
  const inv = invoice({ status: 'Sent', dueDate: '2025-07-05', taxRate: 0, items: [{ id: 'a', description: 'Shoot', quantity: 1, rate: 1000 }] });
  const forecast = buildForecast({ invoices: [inv], payments: [], expenses: [], today: TODAY, horizon: 30, lateDays: 15 });
  assert.equal(forecast.baseline.inflows, 1000);
  assert.equal(forecast.scenario.inflows, 0);
  assert.equal(forecast.scenario.pushedOutCount, 1);
  assert.equal(forecast.scenario.pushedOutAmount, 1000);
});

test('summary expensesMonth counts only paid expenses', () => {
  const expenses = [
    { id: 'e1', vendor: 'Studio', category: 'Studio rent', amount: 100, date: '2025-06-03', status: 'paid' },
    { id: 'e2', vendor: 'Insurer', category: 'Insurance', amount: 200, date: '2025-06-05', dueDate: '2025-06-20', status: 'scheduled' },
  ];
  const summary = buildSummary({ invoices: [], payments: [], expenses, today: TODAY });
  assert.equal(summary.expensesMonth, 100);
  assert.equal(summary.upcomingBills.count, 1);
  assert.equal(summary.upcomingBills.total, 200);
});

test('editing locked fields is refused once payments exist', () => {
  const existing = invoice({ status: 'Sent', taxRate: 8 });
  const payments = [payment(50)];
  const base = {
    clientId: 'cl-1',
    issueDate: '2025-06-01',
    dueDate: '2025-07-01',
    taxRate: 8,
    notes: '',
    items: [{ description: 'Shoot', quantity: 1, rate: 100 }],
  };

  const repriced = validateInvoiceInput(
    { ...base, items: [{ description: 'Shoot', quantity: 1, rate: 120 }] },
    { clients: [CLIENT], existing, payments },
  );
  assert.equal(repriced.ok, false);
  assert.equal(repriced.code, 'LOCKED_BY_PAYMENTS');

  const notesOnly = validateInvoiceInput({ ...base, notes: 'Thanks' }, { clients: [CLIENT], existing, payments });
  assert.equal(notesOnly.ok, true);
});

test('delete rules protect invoices and clients', () => {
  assert.equal(canDeleteInvoice(invoice({ status: 'Sent' }), []).code, 'NOT_DRAFT');
  assert.equal(canDeleteInvoice(invoice({ status: 'Draft' }), [payment(10)]).code, 'HAS_PAYMENTS');
  assert.equal(canDeleteInvoice(invoice({ status: 'Draft' }), []).ok, true);
  assert.equal(canDeleteClient('cl-1', [invoice()]).code, 'HAS_INVOICES');
  assert.equal(canDeleteClient('cl-2', [invoice()]).ok, true);
});

test('settings rejects an unsupported currency', () => {
  const result = validateSettingsInput({ currency: 'JPY' });
  assert.equal(result.ok, false);
  assert.ok(result.fields.currency);
  assert.equal(validateSettingsInput({ currency: 'EUR' }).ok, true);
});
