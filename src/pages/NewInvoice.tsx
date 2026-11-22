import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { useToast } from '../components/Toast';
import type { Invoice } from '../data/sampleData';
import { invoiceTotals, useStore } from '../services/store';
import { AutoGrowNote, TagInput } from '../components/InteractiveMicroWidgets';

interface ItemRow {
  id: string;
  description: string;
  quantity: string;
  rate: string;
}

type Errors = Record<string, string>;
type SaveStatus = Extract<Invoice['status'], 'Draft' | 'Sent'>;

const SUBMIT_DELAY_MS = 400;
let rowSequence = 0;

function newRow(): ItemRow {
  rowSequence += 1;
  return { id: `row-${rowSequence}`, description: '', quantity: '1', rate: '' };
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function numberOrZero(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (message === undefined) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}

export function NewInvoicePage() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const { clients, settings } = state;

  const [clientId, setClientId] = useState<string>(() => clients[0]?.id ?? '');
  const [issueDate, setIssueDate] = useState<string>(() => toIsoDate(new Date()));
  const [dueDate, setDueDate] = useState<string>(() =>
    addDays(toIsoDate(new Date()), settings.paymentTermsDays),
  );
  const [rows, setRows] = useState<ItemRow[]>(() => [newRow()]);
  const [taxRate, setTaxRate] = useState<string>(() => String(settings.defaultTaxRate));
  const [notes, setNotes] = useState<string>('');
  const [invoiceTags, setInvoiceTags] = useState<string[]>(['Photography', 'License']);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  const formatMoney = (amount: number): string =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: settings.currency }).format(amount);

  const previewItems = rows.map((row) => ({
    id: row.id,
    description: row.description,
    quantity: numberOrZero(row.quantity),
    rate: numberOrZero(row.rate),
  }));
  const preview = invoiceTotals({
    id: '',
    number: '',
    clientId,
    issueDate,
    dueDate,
    status: 'Draft',
    items: previewItems,
    taxRate: numberOrZero(taxRate),
    notes,
  });

  function updateRow(id: string, patch: Partial<Omit<ItemRow, 'id'>>): void {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string): void {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function addRow(): void {
    setRows((current) => [...current, newRow()]);
  }

  function validate(): Errors {
    const found: Errors = {};

    if (clientId === '') found.clientId = 'Select a client.';

    if (issueDate === '') {
      found.issueDate = 'Enter an issue date.';
    }
    if (dueDate === '') {
      found.dueDate = 'Enter a due date.';
    } else if (issueDate !== '' && dueDate < issueDate) {
      found.dueDate = 'Due date cannot be before the issue date.';
    }

    const tax = Number(taxRate);
    if (taxRate.trim() === '' || !Number.isFinite(tax) || tax < 0 || tax > 100) {
      found.taxRate = 'Enter a tax rate between 0 and 100.';
    }

    if (rows.length === 0) found.items = 'Add at least one line item.';

    for (const row of rows) {
      if (row.description.trim() === '') {
        found[`${row.id}-description`] = 'Enter a description.';
      }
      const quantity = Number(row.quantity);
      if (row.quantity.trim() === '' || !Number.isFinite(quantity) || quantity <= 0) {
        found[`${row.id}-quantity`] = 'Quantity must be greater than zero.';
      }
      const rate = Number(row.rate);
      if (row.rate.trim() === '' || !Number.isFinite(rate) || rate < 0) {
        found[`${row.id}-rate`] = 'Rate must be zero or more.';
      }
    }

    return found;
  }

  async function save(status: SaveStatus): Promise<void> {
    if (submitting) return;

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.show('Please fix the highlighted fields.', 'error');
      return;
    }

    setSubmitting(true);
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, SUBMIT_DELAY_MS);
    });

    dispatch({
      type: 'addInvoice',
      invoice: {
        clientId,
        issueDate,
        dueDate,
        status,
        taxRate: Number(taxRate),
        notes: notes.trim(),
        items: rows.map((row) => ({
          id: row.id,
          description: row.description.trim(),
          quantity: Number(row.quantity),
          rate: Number(row.rate),
        })),
      },
    });

    toast.show(status === 'Sent' ? 'Invoice sent' : 'Draft saved', 'success');
    navigate('/invoices');
  }

  return (
    <div className="page new-invoice-page">
      <header className="page-header">
        <h1 className="page-title">New invoice</h1>
      </header>

      <form
        className="new-invoice-form"
        noValidate
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          void save('Sent');
        }}
      >
        <div className="new-invoice-grid">
          <div className="new-invoice-main">
            <Card title="Details">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="ni-client">Client</label>
                  <select
                    id="ni-client"
                    value={clientId}
                    aria-invalid={errors.clientId !== undefined}
                    aria-describedby={errors.clientId !== undefined ? 'ni-client-error' : undefined}
                    onChange={(e) => setClientId(e.target.value)}
                  >
                    <option value="">Select a client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} — {client.company}
                      </option>
                    ))}
                  </select>
                  <FieldError id="ni-client-error" message={errors.clientId} />
                </div>

                <div className="form-field">
                  <label htmlFor="ni-issue-date">Issue date</label>
                  <input
                    id="ni-issue-date"
                    type="date"
                    value={issueDate}
                    aria-invalid={errors.issueDate !== undefined}
                    aria-describedby={errors.issueDate !== undefined ? 'ni-issue-date-error' : undefined}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                  <FieldError id="ni-issue-date-error" message={errors.issueDate} />
                </div>

                <div className="form-field">
                  <label htmlFor="ni-due-date">Due date</label>
                  <input
                    id="ni-due-date"
                    type="date"
                    value={dueDate}
                    aria-invalid={errors.dueDate !== undefined}
                    aria-describedby={errors.dueDate !== undefined ? 'ni-due-date-error' : undefined}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                  <FieldError id="ni-due-date-error" message={errors.dueDate} />
                </div>

                <div className="form-field">
                  <label htmlFor="ni-tax-rate">Tax rate (%)</label>
                  <input
                    id="ni-tax-rate"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    inputMode="decimal"
                    value={taxRate}
                    aria-invalid={errors.taxRate !== undefined}
                    aria-describedby={errors.taxRate !== undefined ? 'ni-tax-rate-error' : undefined}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                  <FieldError id="ni-tax-rate-error" message={errors.taxRate} />
                </div>
              </div>
            </Card>

            <Card
              title="Line items"
              action={
                <button type="button" className="btn btn-ghost" onClick={addRow}>
                  Add line item
                </button>
              }
            >
              <FieldError id="ni-items-error" message={errors.items} />
              <div className="line-items">
                <div className="line-items-head" aria-hidden="true">
                  <span>Description</span>
                  <span>Quantity</span>
                  <span>Rate</span>
                  <span>Amount</span>
                  <span />
                </div>
                {rows.map((row, index) => {
                  const lineAmount = numberOrZero(row.quantity) * numberOrZero(row.rate);
                  const descriptionError = errors[`${row.id}-description`];
                  const quantityError = errors[`${row.id}-quantity`];
                  const rateError = errors[`${row.id}-rate`];
                  return (
                    <div className="line-item" key={row.id}>
                      <div className="form-field">
                        <input
                          id={`${row.id}-description-input`}
                          type="text"
                          aria-label={`Line item ${index + 1} description`}
                          placeholder="Description"
                          value={row.description}
                          aria-invalid={descriptionError !== undefined}
                          aria-describedby={descriptionError !== undefined ? `${row.id}-description-error` : undefined}
                          onChange={(e) => updateRow(row.id, { description: e.target.value })}
                        />
                        <FieldError id={`${row.id}-description-error`} message={descriptionError} />
                      </div>
                      <div className="form-field">
                        <input
                          id={`${row.id}-quantity-input`}
                          type="number"
                          min={0}
                          step="any"
                          aria-label={`Line item ${index + 1} quantity`}
                          value={row.quantity}
                          aria-invalid={quantityError !== undefined}
                          aria-describedby={quantityError !== undefined ? `${row.id}-quantity-error` : undefined}
                          onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                        />
                        <FieldError id={`${row.id}-quantity-error`} message={quantityError} />
                      </div>
                      <div className="form-field">
                        <input
                          id={`${row.id}-rate-input`}
                          type="number"
                          min={0}
                          step="0.01"
                          aria-label={`Line item ${index + 1} rate`}
                          value={row.rate}
                          aria-invalid={rateError !== undefined}
                          aria-describedby={rateError !== undefined ? `${row.id}-rate-error` : undefined}
                          onChange={(e) => updateRow(row.id, { rate: e.target.value })}
                        />
                        <FieldError id={`${row.id}-rate-error`} message={rateError} />
                      </div>
                      <span className="line-item-amount">{formatMoney(lineAmount)}</span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label={`Remove line item ${index + 1}`}
                        disabled={rows.length === 1}
                        onClick={() => removeRow(row.id)}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Notes & Deliverable Tags">
              <AutoGrowNote
                id="ni-notes"
                label="Notes for the client (grows a line at a time with a soft spring)"
                value={notes}
                onChange={setNotes}
                placeholder="Include photo delivery links, commercial licensing terms, shoot location details..."
                minRows={3}
              />
              <div style={{ marginTop: 16 }}>
                <TagInput
                  tags={invoiceTags}
                  onChange={setInvoiceTags}
                  label="Deliverable Tags (press Space or Enter to pop chip)"
                  placeholder="e.g. RAW, HighRes, Commercial, Edits..."
                />
              </div>
            </Card>
          </div>

          <aside className="new-invoice-side">
            <Card title="Totals preview">
              <dl className="totals">
                <div className="totals-row">
                  <dt>Subtotal</dt>
                  <dd>{formatMoney(preview.subtotal)}</dd>
                </div>
                <div className="totals-row">
                  <dt>Tax ({numberOrZero(taxRate)}%)</dt>
                  <dd>{formatMoney(preview.tax)}</dd>
                </div>
                <div className="totals-row totals-total">
                  <dt>Total</dt>
                  <dd>{formatMoney(preview.total)}</dd>
                </div>
              </dl>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => navigate('/invoices')}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={() => void save('Draft')}
                >
                  Save draft
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting && <span className="spinner" aria-hidden="true" />}
                  {submitting ? 'Sending…' : 'Send'}
                </button>
              </div>
            </Card>
          </aside>
        </div>
      </form>
    </div>
  );
}
