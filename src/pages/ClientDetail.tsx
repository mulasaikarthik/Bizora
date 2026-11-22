import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { IconEdit } from "../components/Icons";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import type { Client, InvoiceStatus } from "../data/sampleData";
import { invoiceBalance, invoiceTotals, useStore } from "../services/store";

interface ClientForm {
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
}

type FormErrors = Partial<Record<keyof ClientForm, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeMoney(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat("en-US", { style: "currency", currency });
}

function formatDate(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function validateClient(form: ClientForm): FormErrors {
  const errors: FormErrors = {};
  if (form.name.trim() === "") {
    errors.name = "Name is required";
  }
  if (form.email.trim() === "") {
    errors.email = "Email is required";
  } else if (!EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = "Enter a valid email address";
  }
  return errors;
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const slug = status.toLowerCase().replace(/\s+/g, '-');
  return <span className={`status-badge status-${slug}`}>{status}</span>;
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}

function Field({ id, label, value, onChange, error, type, required, autoComplete }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 13, color: "var(--c-text)" }}>
        {label}
        {required === true ? " *" : ""}
      </label>
      <input
        id={id}
        type={type ?? "text"}
        value={value}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error !== undefined && (
        <span id={errorId} role="alert" style={{ fontSize: 12, color: "var(--c-text)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

const EMPTY_FORM: ClientForm = { name: "", company: "", email: "", phone: "", address: "" };

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const money = useMemo(() => makeMoney(state.settings.currency), [state.settings.currency]);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const client = state.clients.find((c) => c.id === id);
  const clientInvoices = state.invoices.filter((i) => client !== undefined && i.clientId === client.id);
  const invoiceIds = new Set(clientInvoices.map((i) => i.id));
  const totalPaid = state.payments
    .filter((p) => invoiceIds.has(p.invoiceId))
    .reduce((sum, p) => sum + p.amount, 0);
  const outstanding = clientInvoices
    .filter((i) => i.status !== "Draft")
    .reduce((sum, i) => sum + invoiceBalance(i, state.payments), 0);

  if (client === undefined) {
    return (
      <div className="page-enter">
        <Card title="Client not found">
          <EmptyState
            title="We couldn't find that client"
            text="It may have been deleted, or the link is out of date."
            action={
              <Link to="/clients" className="btn btn-primary">
                Back to clients
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const openEdit = () => {
    setForm({
      name: client.name,
      company: client.company,
      email: client.email,
      phone: client.phone,
      address: client.address,
    });
    setErrors({});
    setEditOpen(true);
  };

  const setField = (key: keyof ClientForm) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateClient(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const updated: Client = {
      id: client.id,
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    };
    dispatch({ type: "updateClient", client: updated });
    toast.show(`Saved ${updated.name}`, "success");
    setEditOpen(false);
  };

  return (
    <div className="page-enter">
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <Link to="/clients" style={{ fontSize: 13, color: "var(--c-text-2)" }}>
            ← Clients
          </Link>
          <h1 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 700, color: "var(--c-text)" }}>{client.name}</h1>
          {client.company !== "" && <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--c-text-2)" }}>{client.company}</p>}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openEdit}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <IconEdit size={16} />
          Edit client
        </button>
      </header>

      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <Card>
          <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-2)" }}>Total paid</p>
          <p className="money" style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 600, color: "var(--c-text)" }}>
            {money.format(totalPaid)}
          </p>
        </Card>
        <Card>
          <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-2)" }}>Outstanding</p>
          <p className="money" style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 600, color: "var(--c-text)" }}>
            {money.format(outstanding)}
          </p>
        </Card>
        <Card>
          <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-2)" }}>Invoices</p>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 600, color: "var(--c-text)" }}>{clientInvoices.length}</p>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Contact">
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 16px", fontSize: 14 }}>
            <dt style={{ color: "var(--c-text-2)" }}>Email</dt>
            <dd style={{ margin: 0, color: "var(--c-text)" }}>{client.email}</dd>
            <dt style={{ color: "var(--c-text-2)" }}>Phone</dt>
            <dd style={{ margin: 0, color: "var(--c-text)" }}>{client.phone || "—"}</dd>
            <dt style={{ color: "var(--c-text-2)" }}>Company</dt>
            <dd style={{ margin: 0, color: "var(--c-text)" }}>{client.company || "—"}</dd>
            <dt style={{ color: "var(--c-text-2)" }}>Address</dt>
            <dd style={{ margin: 0, color: "var(--c-text)" }}>{client.address || "—"}</dd>
          </dl>
        </Card>

        <Card title="Invoices">
          {clientInvoices.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "var(--c-text-2)" }}>No invoices for this client yet.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {clientInvoices.map((invoice) => (
                <li
                  key={invoice.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--c-border)",
                  }}
                >
                  <div>
                    <Link to={`/invoices/${invoice.id}`} style={{ color: "var(--c-text)", fontWeight: 600 }}>
                      {invoice.number}
                    </Link>
                    <div style={{ fontSize: 12, color: "var(--c-text-2)" }}>Due {formatDate(invoice.dueDate)}</div>
                  </div>
                  <StatusPill status={invoice.status} />
                  <span className="money" style={{ color: "var(--c-text)" }}>
                    {money.format(invoiceTotals(invoice).total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={editOpen}
        title="Edit client"
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="edit-client-form" className="btn btn-primary">
              Save changes
            </button>
          </>
        }
      >
        <form id="edit-client-form" noValidate onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field
            id="edit-client-name"
            label="Name"
            value={form.name}
            onChange={setField("name")}
            error={errors.name}
            required
            autoComplete="name"
          />
          <Field
            id="edit-client-company"
            label="Company"
            value={form.company}
            onChange={setField("company")}
            autoComplete="organization"
          />
          <Field
            id="edit-client-email"
            label="Email"
            type="email"
            value={form.email}
            onChange={setField("email")}
            error={errors.email}
            required
            autoComplete="email"
          />
          <Field
            id="edit-client-phone"
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={setField("phone")}
            autoComplete="tel"
          />
          <Field
            id="edit-client-address"
            label="Address"
            value={form.address}
            onChange={setField("address")}
            autoComplete="street-address"
          />
        </form>
      </Modal>
    </div>
  );
}
