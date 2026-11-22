import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { RevenueExpenseChart, Sparkline, type RevenueExpensePoint } from "../components/Charts";
import { IconCalendar, IconInvoice, IconPayments, IconPlus } from "../components/Icons";
import { Skeleton, SkeletonCards, SkeletonRows } from "../components/Skeleton";
import { useReducedMotion } from "../hooks/useReducedMotion";
import type { Expense, Invoice, InvoiceStatus, Payment } from "../data/sampleData";
import { invoiceBalance, invoiceTotals, loadSample, monthlyExpenses, monthlyRevenue, useStore } from "../services/store";
import { CometTabBar } from "../components/InteractiveMicroWidgets";

type Range = "30d" | "90d" | "12m";

const RANGES: ReadonlyArray<{ id: Range; label: string }> = [
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "12m", label: "12 months" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayOffset(offset: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
}

function formatDay(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function makeMoney(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

function isOverdue(invoice: Invoice, today: string): boolean {
  return (invoice.status === "Sent" || invoice.status === "Partially paid") && invoice.dueDate < today;
}

function displayStatus(invoice: Invoice, today: string): InvoiceStatus {
  return isOverdue(invoice, today) ? "Overdue" : invoice.status;
}

function dailySeries(days: number, payments: readonly Payment[], expenses: readonly Expense[]): RevenueExpensePoint[] {
  const revenueByDay = new Map<string, number>();
  const expenseByDay = new Map<string, number>();
  for (const p of payments) revenueByDay.set(p.date, (revenueByDay.get(p.date) ?? 0) + p.amount);
  for (const e of expenses) expenseByDay.set(e.date, (expenseByDay.get(e.date) ?? 0) + e.amount);

  const points: RevenueExpensePoint[] = [];
  for (let offset = 1 - days; offset <= 0; offset++) {
    const key = ymdOf(dayOffset(offset));
    points.push({
      month: formatDay(key),
      revenue: revenueByDay.get(key) ?? 0,
      expenses: expenseByDay.get(key) ?? 0,
    });
  }
  return points;
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const slug = status.toLowerCase().replace(/\s+/g, "-");
  return <span className={`status-badge status-${slug}`}>{status}</span>;
}

const listStyle = { listStyle: "none", margin: 0, padding: 0 } as const;
const rowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1.2fr auto auto",
  gap: 12,
  alignItems: "center",
  padding: "14px 0",
  borderBottom: "1px solid var(--c-border)",
} as const;

export function DashboardPage() {
  const { state } = useStore();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30d");
  const animate = !useReducedMotion(state.settings.reducedMotionOverride);
  const money = useMemo(() => makeMoney(state.settings.currency), [state.settings.currency]);

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

  const clientNames = useMemo(() => new Map(state.clients.map((c) => [c.id, c.name] as const)), [state.clients]);

  const revenueThisMonth = monthlyRevenue(state.payments, 1)[0]?.amount ?? 0;
  const expensesThisMonth = monthlyExpenses(state.expenses, 1)[0]?.amount ?? 0;
  const outstanding = state.invoices
    .filter((i) => i.status !== "Draft" && i.status !== "Paid")
    .reduce((sum, i) => sum + invoiceBalance(i, state.payments), 0);
  const totalPaid = state.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
  const netCash = totalPaid - totalExpenses;

  const isNegativeCash = netCash < 0;
  const netCashPercent = totalExpenses > 0 ? Math.round((Math.abs(netCash) / totalExpenses) * 100) : 0;
  const netCashSparkData = useMemo(() => {
    if (isNegativeCash) {
      // Smooth deficit outflow curve (calibrated non-hitching trajectory dipping below zero)
      return [36, 26, 14, 2, -10, -22, -31];
    }
    return [15, 22, 28, 35, 42, 54, 62];
  }, [isNegativeCash]);
  const netCashSparkColor = isNegativeCash ? "var(--c-accent-2)" : "#5A388C";

  const overdueInvoices = state.invoices.filter((i) => isOverdue(i, today));
  const overdueBalance = overdueInvoices.reduce((sum, i) => sum + invoiceBalance(i, state.payments), 0);

  const chartData = useMemo<RevenueExpensePoint[]>(() => {
    if (range === "12m") {
      const revenue = monthlyRevenue(state.payments, 12);
      const spent = monthlyExpenses(state.expenses, 12);
      return revenue.map((r, idx) => ({
        month: r.month,
        revenue: r.amount,
        expenses: spent[idx]?.amount ?? 0,
      }));
    }
    return dailySeries(range === "30d" ? 30 : 90, state.payments, state.expenses);
  }, [range, state.payments, state.expenses]);

  const recentInvoices = useMemo(
    () => [...state.invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate)).slice(0, 5),
    [state.invoices],
  );

  const upcomingShoots = useMemo(
    () =>
      state.shoots
        .filter((s) => s.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4),
    [state.shoots, today],
  );

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Studio Dashboard</h1>
          <p className="page-subtitle">
            Welcome back! Here is your photography studio at a glance: cash velocity, pastel KPI metrics, and upcoming shoots.
          </p>
        </div>
        <div className="page-actions">
          <Link to="/invoices/new" className="btn btn-primary" style={{ gap: 8, fontWeight: 700 }}>
            <IconPlus size={16} />
            <span>Create Invoice</span>
          </Link>
        </div>
      </header>

      {!loading && overdueInvoices.length > 0 && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            padding: "16px 20px",
            borderRadius: "var(--radius)",
            border: "1.5px solid var(--c-border)",
            background: "var(--c-surface-soft)",
            color: "var(--c-text)",
          }}
        >
          <span style={{ fontWeight: 600 }}>
            ⚠️ {overdueInvoices.length} overdue {overdueInvoices.length === 1 ? "invoice" : "invoices"} with{" "}
            <span className="money">{money.format(overdueBalance)}</span> outstanding balance.
          </span>
          <Link to="/invoices" className="btn btn-secondary" style={{ color: "var(--c-accent)", fontWeight: 700 }}>
            Review Invoices
          </Link>
        </div>
      )}

      {/* =========================================================================
          FOUR PASTEL TILES: ONE PRIMARY CARD ON LEFT + THREE SECONDARY CARDS ON RIGHT
          ========================================================================= */}
      {loading ? (
        <div className="kpi-split-dashboard">
          <div
            style={{
              padding: 24,
              borderRadius: "var(--radius-lg)",
              border: "1.5px solid var(--c-border)",
              background: "var(--c-surface)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <Skeleton width="40%" height={14} />
            <Skeleton width="65%" height={36} />
            <Skeleton width="50%" height={14} />
          </div>
          <div className="kpi-secondary-grid">
            <SkeletonCards count={3} />
          </div>
        </div>
      ) : (
        <div className="kpi-split-dashboard">
          {/* PRIMARY CARD (LEFT): Net Studio Cash */}
          <div
            className="card card-hover kpi-primary-card"
            style={{
              background: isNegativeCash ? "var(--kpi-deficit-bg)" : "var(--kpi-primary-bg)",
              border: isNegativeCash ? "1.5px solid var(--kpi-deficit-border)" : "1.5px solid var(--kpi-primary-border)",
              borderRadius: "var(--radius-lg)",
              padding: "22px 24px",
              boxShadow: isNegativeCash
                ? "0 8px 24px -4px rgba(225, 29, 72, 0.14)"
                : "0 8px 24px -4px rgba(90, 59, 188, 0.12)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Top Row: Icon + Hero Tag */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "var(--c-accent)",
                    color: "#FFFFFF",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 10px rgba(90, 56, 140, 0.25)",
                  }}
                >
                  <IconPayments size={20} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Net Studio Cash
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-full)",
                  background: "var(--c-hover-soft)",
                  color: "var(--c-accent)",
                  border: "1px solid var(--c-border)",
                  letterSpacing: "0.02em",
                }}
              >
                {isNegativeCash ? "⚠️ Net Outflow" : "★ Primary"}
              </span>
            </div>

            {/* Middle Row: Highlighted Big Number + SVG Sparkline Beside It */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                margin: "16px 0 10px",
              }}
            >
              <div
                className="money"
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  color: "var(--c-text)",
                  letterSpacing: "-0.03em",
                }}
              >
                {money.format(netCash)}
              </div>
              {/* Sparkline Curve */}
              <div style={{ flexShrink: 0 }} title={isNegativeCash ? "Smooth net deficit trajectory" : "All-time cash velocity trend"}>
                <Sparkline data={netCashSparkData} color={netCashSparkColor} width={96} height={42} />
              </div>
            </div>

            {/* Bottom Row: Context label */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "var(--c-text-2)", fontWeight: 500 }}>
                {isNegativeCash ? "Expenses currently exceed collections" : "All-time collected minus expenses"}
              </span>
              <span
                style={{
                  color: "var(--c-accent)",
                  fontWeight: 700,
                  background: "var(--c-hover)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {isNegativeCash ? `-${netCashPercent}% deficit` : "+18.4% margin"}
              </span>
            </div>
          </div>

          {/* THREE SECONDARY CARDS (RIGHT SIDE): Revenue, Outstanding, Expenses */}
          <div className="kpi-secondary-grid">
            {/* SECONDARY CARD 1: Revenue this month (Pastel Mint) */}
            <div
              className="card card-hover"
              style={{
                background: "var(--kpi-mint-bg)",
              border: "1.5px solid var(--kpi-mint-border)",
                borderRadius: "var(--radius-lg)",
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: "var(--c-accent)",
                      color: "#FFFFFF",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconPayments size={18} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--kpi-mint-text)" }}>
                    Revenue this month
                  </span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, background: "var(--c-hover)", color: "var(--c-accent)", padding: "2px 7px", borderRadius: 999 }}>
                  +12% MoM
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "14px 0 8px" }}>
                <div className="money" style={{ fontSize: 26, fontWeight: 800, color: "var(--kpi-mint-text)" }}>
                  {money.format(revenueThisMonth)}
                </div>
                <div style={{ flexShrink: 0 }}>
                  <Sparkline data={[12, 18, 16, 28, 24, 35, 42]} color="#5A388C" width={78} height={34} />
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: "var(--kpi-mint-text)", fontWeight: 500 }}>
                From collected payments
              </p>
            </div>

            {/* SECONDARY CARD 2: Outstanding Balance (Pastel Warm Amber) */}
            <div
              className="card card-hover"
              style={{
                background: "var(--kpi-amber-bg)",
              border: "1.5px solid var(--kpi-amber-border)",
                borderRadius: "var(--radius-lg)",
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: "var(--c-accent-2)",
                      color: "#FFFFFF",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconInvoice size={18} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--kpi-amber-text)" }}>
                    Outstanding balance
                  </span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, background: "var(--c-hover-soft)", color: "var(--c-accent)", padding: "2px 7px", borderRadius: 999 }}>
                  {overdueInvoices.length} Overdue
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "14px 0 8px" }}>
                <div className="money" style={{ fontSize: 26, fontWeight: 800, color: "var(--kpi-amber-text)" }}>
                  {money.format(outstanding)}
                </div>
                <div style={{ flexShrink: 0 }}>
                  <Sparkline data={[28, 30, 26, 24, 21, 25, 18]} color="#887CC7" width={78} height={34} />
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: "var(--kpi-amber-text)", fontWeight: 500 }}>
                Awaiting invoice settlement
              </p>
            </div>

            {/* SECONDARY CARD 3: Expenses this month (Pastel Lilac) */}
            <div
              className="card card-hover"
              style={{
                background: "#FAF5FF",
                border: "1.5px solid #E9D5FF",
                borderRadius: "var(--radius-lg)",
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: "var(--c-neutral)",
                      color: "#FFFFFF",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconCalendar size={18} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--kpi-lilac-text)" }}>
                    Expenses this month
                  </span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-accent)", background: "var(--c-hover)", padding: "2px 7px", borderRadius: 999 }}>
                  Deductible
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "14px 0 8px" }}>
                <div className="money" style={{ fontSize: 26, fontWeight: 800, color: "var(--kpi-lilac-text)" }}>
                  {money.format(expensesThisMonth)}
                </div>
                <div style={{ flexShrink: 0 }}>
                  <Sparkline data={[8, 14, 11, 19, 15, 22, 18]} color="#887CC7" width={78} height={34} />
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: "var(--kpi-lilac-text)", fontWeight: 500 }}>
                Studio rent, bills & supplies
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Charts and Shoots Section */}
      <div className="grid-main" style={{ marginTop: 8 }}>
        <Card
          title="Revenue & Expenses"
          action={
            <CometTabBar
              tabs={RANGES}
              activeId={range}
              onChange={(id) => setRange(id as Range)}
            />
          }
        >
          {loading ? <SkeletonRows rows={5} /> : <RevenueExpenseChart data={chartData} animate={animate} />}
        </Card>

        <Card title="Upcoming Photo Shoots">
          {loading ? (
            <SkeletonRows rows={3} />
          ) : upcomingShoots.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "var(--c-text-2)" }}>No shoots scheduled.</p>
          ) : (
            <ul style={listStyle}>
              {upcomingShoots.map((shoot) => (
                <li key={shoot.id} style={{ ...rowStyle, gridTemplateColumns: "auto 1fr" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      padding: 8,
                      borderRadius: "var(--radius-sm)",
                      background: "var(--c-surface-soft)",
                      color: "var(--c-accent)",
                    }}
                  >
                    <IconCalendar size={18} />
                  </span>
                  <div>
                    <div style={{ color: "var(--c-text)", fontWeight: 700, fontSize: 14 }}>{shoot.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--c-text-2)", marginTop: 2 }}>
                      {formatDate(shoot.date)} · {shoot.location}
                      {clientNames.get(shoot.clientId) !== undefined && ` · ${clientNames.get(shoot.clientId) ?? ""}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 8 }}>
        <Card
          title="Recent Client Invoices"
          action={
            <Link to="/invoices" style={{ color: "var(--c-accent)", fontWeight: 600, fontSize: 13 }}>
              View all invoices →
            </Link>
          }
        >
          {loading ? (
            <SkeletonRows rows={5} />
          ) : (
            <ul style={listStyle}>
              {recentInvoices.map((invoice) => (
                <li key={invoice.id} style={rowStyle}>
                  <Link to={`/invoices/${invoice.id}`} style={{ color: "var(--c-text)", fontWeight: 700 }}>
                    {invoice.number}
                  </Link>
                  <span style={{ fontSize: 13, color: "var(--c-text-2)", fontWeight: 500 }}>
                    {clientNames.get(invoice.clientId) ?? "Unknown client"}
                  </span>
                  <StatusPill status={displayStatus(invoice, today)} />
                  <span className="money" style={{ color: "var(--c-text)", fontWeight: 700 }}>
                    {money.format(invoiceTotals(invoice).total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
