import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { useSearchQuery } from "../components/Layout";
import { IconPlus } from "../components/Icons";
import { SkeletonRows } from "../components/Skeleton";
import type { Client, Invoice, InvoiceStatus } from "../data/sampleData";
import { invoiceBalance, invoiceTotals, loadSample, useStore } from "../services/store";
import { CometTabBar } from "../components/InteractiveMicroWidgets";

type Tab = "All" | "Draft" | "Sent" | "Partially paid" | "Paid" | "Overdue";
type SortKey = "date" | "amount";

const TABS: readonly Tab[] = ["All", "Draft", "Sent", "Partially paid", "Paid", "Overdue"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function makeMoney(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

/* An invoice is overdue when it is Sent or Partially paid and its due date has passed. */
function isOverdue(invoice: Invoice, today: string): boolean {
  return (invoice.status === "Sent" || invoice.status === "Partially paid") && invoice.dueDate < today;
}

function displayStatus(invoice: Invoice, today: string): InvoiceStatus {
  return isOverdue(invoice, today) ? "Overdue" : invoice.status;
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const slug = status.toLowerCase().replace(/\s+/g, "-");
  return <span className={`status-badge status-${slug}`}>{status}</span>;
}

interface InvoiceRow {
  invoice: Invoice;
  clientName: string;
  company: string;
  total: number;
  balance: number;
  status: InvoiceStatus;
}

export function InvoicesPage() {
  const { state } = useStore();
  const query = useSearchQuery().trim().toLowerCase();
  const money = useMemo(() => makeMoney(state.settings.currency), [state.settings.currency]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("All");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  useEffect(() => {
    let active = true;
    loadSample().then(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const today = ymdOf(new Date());

  const rows = useMemo<InvoiceRow[]>(() => {
    const clients = new Map<string, Client>(state.clients.map((c) => [c.id, c] as const));
    return state.invoices.map((invoice) => {
      const client = clients.get(invoice.clientId);
      return {
        invoice,
        clientName: client?.name ?? "Unknown client",
        company: client?.company ?? "",
        total: invoiceTotals(invoice).total,
        balance: invoiceBalance(invoice, state.payments),
        status: displayStatus(invoice, today),
      };
    });
  }, [state.clients, state.invoices, state.payments, today]);

  const tabCounts = useMemo(() => {
    const counts = new Map<Tab, number>();
    for (const tabName of TABS) {
      counts.set(tabName, tabName === "All" ? rows.length : rows.filter((r) => r.status === tabName).length);
    }
    return counts;
  }, [rows]);

  const visible = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (tab !== "All" && row.status !== tab) return false;
      if (query === "") return true;
      return [row.invoice.number, row.clientName, row.company].some((value) => value.toLowerCase().includes(query));
    });
    return filtered.sort((a, b) =>
      sortKey === "amount"
        ? b.total - a.total
        : b.invoice.issueDate.localeCompare(a.invoice.issueDate),
    );
  }, [rows, tab, query, sortKey]);

  const hasAnyInvoices = state.invoices.length > 0;

  return (
    <div className="page invoices-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Track every shoot invoice from draft to paid in real time.</p>
        </div>
        <div className="page-actions">
          <Link to="/invoices/new" className="btn btn-primary" style={{ gap: 8, fontWeight: 700 }}>
            <IconPlus size={16} />
            <span>New Invoice</span>
          </Link>
        </div>
      </header>

      {/* Status Filter with Comet Tab Bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <CometTabBar
          tabs={TABS.map((t) => ({
            id: t,
            label: t,
            badge: tabCounts.get(t) ?? 0,
          }))}
          activeId={tab}
          onChange={(id) => setTab(id as Tab)}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="inv-sort" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-2)" }}>
            Sort by:
          </label>
          <select
            id="inv-sort"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            style={{ padding: "6px 12px", width: "auto", fontSize: 13 }}
          >
            <option value="date">Date (newest)</option>
            <option value="amount">Amount (highest)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Card>
          <SkeletonRows rows={6} />
        </Card>
      ) : !hasAnyInvoices ? (
        <Card>
          <EmptyState
            title="No invoices yet"
            text="Create your first photography invoice to start billing your clients."
            action={
              <Link to="/invoices/new" className="btn btn-primary">
                New Invoice
              </Link>
            }
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            title="No invoices match"
            text="Try selecting another status tab or clear your search."
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setTab("All")}
              >
                Show all invoices
              </button>
            }
          />
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Invoice #</th>
                <th scope="col">Client</th>
                <th scope="col">Issued</th>
                <th scope="col">Due Date</th>
                <th scope="col">Status</th>
                <th scope="col" style={{ textAlign: "right" }}>Total</th>
                <th scope="col" style={{ textAlign: "right" }}>Balance Due</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.invoice.id}>
                  <td data-label="Invoice">
                    <Link to={`/invoices/${row.invoice.id}`} style={{ color: "var(--c-text)", fontWeight: 700 }}>
                      {row.invoice.number}
                    </Link>
                  </td>
                  <td data-label="Client">
                    <div style={{ fontWeight: 600, color: "var(--c-text)" }}>{row.clientName}</div>
                    {row.company && <div style={{ fontSize: 12, color: "var(--c-accent)" }}>{row.company}</div>}
                  </td>
                  <td data-label="Issued" style={{ color: "var(--c-text-2)" }}>
                    {formatDate(row.invoice.issueDate)}
                  </td>
                  <td data-label="Due" style={{ color: "var(--c-text-2)" }}>
                    {formatDate(row.invoice.dueDate)}
                  </td>
                  <td data-label="Status">
                    <StatusPill status={row.status} />
                  </td>
                  <td data-label="Total" className="money" style={{ textAlign: "right", fontWeight: 700 }}>
                    {money.format(row.total)}
                  </td>
                  <td
                    data-label="Balance"
                    className="money"
                    style={{
                      textAlign: "right",
                      fontWeight: 700,
                      color: row.balance > 0 ? "var(--c-accent)" : "var(--c-mint)",
                    }}
                  >
                    {money.format(row.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
