import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PAYMENT_METHODS, type PaymentMethod } from '../data/sampleData';
import { invoiceBalance, invoiceTotals, useStore, validatePayment } from '../services/store';
import { CardNumberInput, OtpCodeInput } from '../components/InteractiveMicroWidgets';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch } = useStore();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Bank transfer');
  const [payDate, setPayDate] = useState(todayIso());
  const [payError, setPayError] = useState<string | null>(null);
  const [requireOtp, setRequireOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const invoice = state.invoices.find((i) => i.id === id);

  if (!invoice) {
    return (
      <div className="page">
        <Card>
          <EmptyState
            title="Invoice not found"
            text="This invoice may have been removed, or the link is incorrect."
            action={
              <Link to="/invoices" className="btn btn-primary">
                Back to invoices
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const currency = state.settings.currency;
  const client = state.clients.find((c) => c.id === invoice.clientId);
  const totals = invoiceTotals(invoice);
  const balance = invoiceBalance(invoice, state.payments);
  const invoicePayments = state.payments.filter((p) => p.invoiceId === invoice.id);
  const paidTotal = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
  const statusSlug = invoice.status.toLowerCase().replace(/\s+/g, '-');

  function openPaymentModal() {
    setPayAmount(balance.toFixed(2));
    setPayMethod('Bank transfer');
    setPayDate(todayIso());
    setPayError(null);
    setPaymentOpen(true);
  }

  function handleRecordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(payAmount);
    const message =
      validatePayment(invoice!, state.payments, amount) ??
      (payDate === '' ? 'Choose a payment date' : null);
    if (message !== null) {
      setPayError(message);
      return;
    }
    dispatch({ type: 'recordPayment', invoiceId: invoice!.id, amount, method: payMethod, date: payDate });
    setPaymentOpen(false);
  }

  function handleMarkAsPaid() {
    if (balance <= 0) return;
    dispatch({
      type: 'recordPayment',
      invoiceId: invoice!.id,
      amount: balance,
      method: 'Bank transfer',
      date: todayIso(),
    });
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{invoice.number}</h1>
          <p className="page-subtitle">
            {client !== undefined ? client.company || client.name : 'Unknown client'}
          </p>
        </div>
        <div className="page-actions">
          <span className={`status-badge status-${statusSlug}`}>{invoice.status}</span>
          {invoice.status === 'Draft' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dispatch({ type: 'sendInvoice', id: invoice.id })}
            >
              Send
            </button>
          )}
          {balance > 0 && (
            <button type="button" className="btn btn-secondary" onClick={handleMarkAsPaid}>
              Mark as paid
            </button>
          )}
          {balance > 0 && (
            <button type="button" className="btn btn-primary" onClick={openPaymentModal}>
              Record payment
            </button>
          )}
        </div>
      </header>

      <div className="grid-two">
        <Card title="Details">
          <dl className="detail-list">
            <dt>Client</dt>
            <dd>{client !== undefined ? client.name : 'Unknown client'}</dd>
            <dt>Issue date</dt>
            <dd>{formatDate(invoice.issueDate)}</dd>
            <dt>Due date</dt>
            <dd>{formatDate(invoice.dueDate)}</dd>
            <dt>Tax rate</dt>
            <dd>{invoice.taxRate}%</dd>
            {invoice.notes !== '' && (
              <>
                <dt>Notes</dt>
                <dd>{invoice.notes}</dd>
              </>
            )}
          </dl>
        </Card>

        <Card title="Summary">
          <dl className="detail-list">
            <dt>Subtotal</dt>
            <dd>{formatMoney(totals.subtotal, currency)}</dd>
            <dt>Tax ({invoice.taxRate}%)</dt>
            <dd>{formatMoney(totals.tax, currency)}</dd>
            <dt>Total</dt>
            <dd>{formatMoney(totals.total, currency)}</dd>
            <dt>Paid</dt>
            <dd>{formatMoney(paidTotal, currency)}</dd>
            <dt>Balance due</dt>
            <dd>{formatMoney(balance, currency)}</dd>
          </dl>
        </Card>
      </div>

      <Card title="Line items">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Description</th>
                <th scope="col">Qty</th>
                <th scope="col">Rate</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((li) => (
                <tr key={li.id}>
                  <td data-label="Description">{li.description}</td>
                  <td data-label="Qty">{li.quantity}</td>
                  <td data-label="Rate">{formatMoney(li.rate, currency)}</td>
                  <td data-label="Amount">{formatMoney(li.quantity * li.rate, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Payments">
        {invoicePayments.length === 0 ? (
          <EmptyState title="No payments yet" text="Payments recorded against this invoice will appear here." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Method</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoicePayments.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Date">{formatDate(p.date)}</td>
                    <td data-label="Method">{p.method}</td>
                    <td data-label="Amount">{formatMoney(p.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={paymentOpen}
        title="Record payment"
        onClose={() => setPaymentOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPaymentOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="record-payment-form" className="btn btn-primary">
              Record payment
            </button>
          </>
        }
      >
        <form id="record-payment-form" onSubmit={handleRecordPayment} noValidate>
          <div className="form-field">
            <label htmlFor="pay-amount">Amount ({currency})</label>
            <input
              id="pay-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="pay-method">Method</label>
            <select
              id="pay-method"
              value={payMethod}
              onChange={(e) => {
                const method = PAYMENT_METHODS.find((m) => m === e.target.value);
                if (method !== undefined) setPayMethod(method);
              }}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="pay-date">Date</label>
            <input id="pay-date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>

          {payMethod === 'Card' && (
            <div style={{ marginTop: 12 }}>
              <CardNumberInput />
            </div>
          )}

          <div style={{ marginTop: 14, padding: 12, background: 'var(--c-surface-soft)', borderRadius: 'var(--radius)', border: '1px solid var(--c-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={requireOtp}
                onChange={(e) => setRequireOtp(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--c-accent)' }}
              />
              <span>Verify transaction with 6-digit Security Code</span>
            </label>

            {requireOtp && (
              <div style={{ marginTop: 12 }}>
                <OtpCodeInput onComplete={(code) => setOtpCode(code)} label="2-Factor Authorization Code" helperText="Boxes fill one by one, then turn mint in a wave upon completion" />
                {otpCode && <span style={{ display: 'none' }}>{otpCode}</span>}
              </div>
            )}
          
          </div>
          {payError !== null && (
            <p role="alert" className="form-error">
              {payError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}
