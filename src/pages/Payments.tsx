import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { PAYMENT_METHODS, type PaymentMethod } from "../data/sampleData";
import { invoiceBalance, useStore, validatePayment } from "../services/store";
import { CardNumberInput, CometTabBar, GhostInput, OtpCodeInput } from "../components/InteractiveMicroWidgets";
import { IconInvoice, IconPlus } from "../components/Icons";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FORM_ID = "record-payment-form";

// Visual styling tokens per payment method
const DEFAULT_METHOD_STYLE = {
  bg: "var(--c-surface-soft, #FDEBFA)",
  color: "#5A388C",
  border: "var(--c-border, #E6E0F0)",
  icon: "💳",
};

const METHOD_STYLES: Record<string, { bg: string; color: string; border: string; icon: string }> = {
  "Bank transfer": { bg: "var(--c-surface-soft)", color: "var(--c-accent)", border: "var(--c-border)", icon: "🏛" },
  Card: { bg: "#FDEBFA", color: "#5A388C", border: "#D8C5ED", icon: "💳" },
  "Credit card": { bg: "#FDEBFA", color: "#5A388C", border: "#D8C5ED", icon: "💳" },
  Cash: { bg: "#F5ECFE", color: "#887CC7", border: "#C9C3E3", icon: "💵" },
  PayPal: { bg: "#FFFFFF", color: "#3A3A52", border: "var(--c-border)", icon: "🅿" },
  Other: { bg: "#F8F7FC", color: "#5B5270", border: "#E6E0F0", icon: "📄" },
};

function getMethodStyle(method: string | undefined) {
  if (!method) return DEFAULT_METHOD_STYLE;
  return METHOD_STYLES[method] ?? DEFAULT_METHOD_STYLE;
}

type ViewMode = "cards" | "table";

export function PaymentsPage() {
  const { state, dispatch } = useStore();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Bank transfer");
  const [date, setDate] = useState(todayYmd());
  const [attempted, setAttempted] = useState(false);
  const [selectedMethodTab, setSelectedMethodTab] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [enableOtp, setEnableOtp] = useState(false);

  const money = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: state.settings.currency, maximumFractionDigits: 0 }),
    [state.settings.currency],
  );

  const invoicesById = useMemo(() => new Map(state.invoices.map((i) => [i.id, i] as const)), [state.invoices]);
  const clientsById = useMemo(() => new Map(state.clients.map((c) => [c.id, c] as const)), [state.clients]);

  const payable = useMemo(
    () => (state.invoices || []).filter((i) => invoiceBalance(i, state.payments || []) > 0),
    [state.invoices, state.payments],
  );

  const sortedPayments = useMemo(
    () => [...(state.payments || [])].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [state.payments],
  );

  // Overall Financial Statistics
  const totalCollected = useMemo(
    () => (state.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [state.payments],
  );

  const avgPayment = (state.payments || []).length > 0 ? Math.round(totalCollected / state.payments.length) : 0;

  // Breakdown by Method
  const methodStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {
      "Bank transfer": { count: 0, total: 0 },
      Card: { count: 0, total: 0 },
      Cash: { count: 0, total: 0 },
      PayPal: { count: 0, total: 0 },
    };
    for (const p of state.payments || []) {
      const key = (p.method as string) === "Credit card" ? "Card" : (p.method || "Card");
      if (!stats[key]) {
        stats[key] = { count: 0, total: 0 };
      }
      stats[key].count += 1;
      stats[key].total += Number(p.amount) || 0;
    }
    return stats;
  }, [state.payments]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return sortedPayments.filter((p) => {
      if (selectedMethodTab !== "All" && p.method !== selectedMethodTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inv = invoicesById.get(p.invoiceId);
        const client = inv ? clientsById.get(inv.clientId) : undefined;
        const matchesNumber = inv?.number.toLowerCase().includes(q);
        const matchesClient = client?.name.toLowerCase().includes(q) || client?.company.toLowerCase().includes(q);
        const matchesMethod = p.method.toLowerCase().includes(q);
        if (!matchesNumber && !matchesClient && !matchesMethod) return false;
      }
      return true;
    });
  }, [sortedPayments, selectedMethodTab, searchQuery, invoicesById, clientsById]);

  const selected = payable.find((i) => i.id === invoiceId);

  const validation: string | null = (() => {
    if (selected === undefined) return "Select an invoice with an outstanding balance";
    if (date === "") return "Choose a payment date";
    return validatePayment(selected, state.payments, Number(amount));
  })();

  const shownError = attempted || amount.trim() !== "" ? validation : null;

  const openModal = () => {
    setInvoiceId(payable[0]?.id ?? "");
    setAmount("");
    setMethod("Bank transfer");
    setDate(todayYmd());
    setAttempted(false);
    setEnableOtp(false);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    if (selected === undefined || validation !== null) return;
    dispatch({
      type: "recordPayment",
      invoiceId: selected.id,
      amount: Number(amount),
      method,
      date,
    });
    toast.show(`Payment of ${money.format(Number(amount))} recorded for ${selected.number}`, "success");
    setModalOpen(false);
  };

  const handleDownloadReceipt = (paymentId: string) => {
    const pid = paymentId ? String(paymentId).slice(-6).toUpperCase() : "000000";
    toast.show(`Payment receipt #${pid} generated for download!`, "info");
  };

  return (
    <div className="page payments-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Payment Collections & Ledger</h1>
          <p className="page-subtitle">
            Real-time transaction stream, multi-channel payment distribution, and instant receipt vouchers.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openModal} style={{ gap: 8, fontWeight: 700 }}>
            <IconPlus size={16} />
            <span>Record Payment</span>
          </button>
        </div>
      </header>

      {/* KPI Summary Tiles for Payments */}
      <div className="grid-kpi">
        <div className="card" style={{ background: "var(--c-surface)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-2)", fontWeight: 600 }}>Total Collected Revenue</p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--c-accent)" }}>{money.format(totalCollected)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--c-mint)", background: "rgba(16, 185, 129, 0.12)", padding: "2px 8px", borderRadius: 999 }}>
              100% Cleared
            </span>
          </div>
        </div>

        <div className="card" style={{ background: "var(--c-surface)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-2)", fontWeight: 600 }}>Total Transactions</p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--c-text)" }}>{state.payments.length}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--c-accent-2)", background: "var(--c-surface-soft)", padding: "2px 8px", borderRadius: 999 }}>
              Settled
            </span>
          </div>
        </div>

        <div className="card" style={{ background: "var(--c-surface)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-2)", fontWeight: 600 }}>Average Transaction Size</p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--c-text)" }}>{money.format(avgPayment)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--c-accent)", background: "var(--c-surface-soft)", padding: "2px 8px", borderRadius: 999 }}>
              Per shoot
            </span>
          </div>
        </div>

        <div className="card" style={{ background: "var(--c-surface)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-2)", fontWeight: 600 }}>Invoices Awaiting Balance</p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--c-accent)" }}>
              {payable.length}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--c-accent)", background: "var(--c-surface-soft)", padding: "2px 8px", borderRadius: 999 }}>
              {payable.length > 0 ? "Actionable" : "All Paid"}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Method Distribution Pastel Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {PAYMENT_METHODS.map((m) => {
          const style = getMethodStyle(m);
          const st = methodStats[m] ?? { count: 0, total: 0 };
          const pct = totalCollected > 0 ? Math.round((st.total / totalCollected) * 100) : 0;
          return (
            <div
              key={m}
              className="card card-hover"
              onClick={() => setSelectedMethodTab(selectedMethodTab === m ? "All" : m)}
              style={{
                background: style.bg,
                border: `1.5px solid ${style.border}`,
                borderRadius: "var(--radius)",
                padding: "16px 18px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 22 }}>{style.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: style.color, background: "#FFFFFF", padding: "2px 8px", borderRadius: 999 }}>
                  {pct}% of funds
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: style.color }}>{m}</p>
                <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: style.color }}>{money.format(st.total)}</p>
              </div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--c-text-2)" }}>
                {st.count} {st.count === 1 ? "payment" : "payments"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls & Filter Bar */}
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: 14,
        }}
      >
        <CometTabBar
          tabs={[
            { id: "All", label: "All Methods", badge: (state.payments || []).length },
            ...PAYMENT_METHODS.map((m) => ({ id: m, label: m, badge: methodStats[m]?.count ?? 0 })),
          ]}
          activeId={selectedMethodTab}
          onChange={setSelectedMethodTab}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 240 }}>
            <GhostInput
              value={searchQuery}
              onChange={setSearchQuery}
              suggestions={["INV-", "Card", "Bank transfer", "PayPal", ...state.clients.map((c) => c.name)]}
              placeholder="Filter by invoice, client, method..."
            />
          </div>

          <CometTabBar
            tabs={[
              { id: "cards", label: "Vouchers" },
              { id: "table", label: "Ledger Table" },
            ]}
            activeId={viewMode}
            onChange={(id) => setViewMode(id as ViewMode)}
          />
        </div>
      </div>

      {/* Transactions Stream: Cards View or Ledger Table */}
      {filteredPayments.length === 0 ? (
        <Card title="No payments matched">
          <p className="empty-state">
            {searchQuery || selectedMethodTab !== "All"
              ? "No payments match the active filter criteria."
              : "No payments recorded yet. Start by recording a payment against any invoice."}
          </p>
        </Card>
      ) : viewMode === "cards" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {filteredPayments.map((p) => {
            const invoice = p.invoiceId ? invoicesById.get(p.invoiceId) : undefined;
            const client = invoice ? clientsById.get(invoice.clientId) : undefined;
            const style = getMethodStyle(p.method);
            const voucherId = p.id ? `RCP-${String(p.id).slice(-6).toUpperCase()}` : "RCP-000000";

            return (
              <div
                key={p.id}
                className="card card-hover"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: 20,
                  borderRadius: "var(--radius-lg)",
                  background: "var(--c-surface)",
                  position: "relative",
                  borderLeft: `4px solid ${style.color}`,
                }}
              >
                {/* Voucher Top */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-3)", letterSpacing: "0.06em" }}>
                      VOUCHER {voucherId}
                    </span>
                    <h3 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>
                      {client?.name ?? "Studio Client"}
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-accent)" }}>
                      {client?.company || "Private Engagement"}
                    </p>
                  </div>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: "var(--radius-full)",
                      background: style.bg,
                      color: style.color,
                      border: `1px solid ${style.border}`,
                    }}
                  >
                    <span>{style.icon}</span>
                    <span>{p.method}</span>
                  </span>
                </div>

                {/* Amount & Date Bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "var(--c-surface-soft)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)" }}>Amount Received</span>
                  <span className="money" style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)" }}>
                    {money.format(p.amount)}
                  </span>
                </div>

                {/* Invoice Link & Date */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <IconInvoice size={15} />
                    {invoice ? (
                      <Link to={`/invoices/${invoice.id}`} style={{ fontWeight: 700, color: "var(--c-accent)" }}>
                        {invoice.number}
                      </Link>
                    ) : (
                      <span>Unlinked</span>
                    )}
                  </div>
                  <span style={{ color: "var(--c-text-3)" }}>Settled on {p.date}</span>
                </div>

                {/* Quick Receipt Voucher Action */}
                <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleDownloadReceipt(p.id)}
                    style={{ flex: 1, fontSize: 12, fontWeight: 600 }}
                  >
                    Download Receipt
                  </button>
                  {invoice && (
                    <Link to={`/invoices/${invoice.id}`} className="btn btn-ghost" style={{ fontSize: 12, fontWeight: 600 }}>
                      View Invoice
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Enhanced Pro Ledger Table */
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Voucher #</th>
                <th scope="col">Client</th>
                <th scope="col">Invoice</th>
                <th scope="col">Payment Method</th>
                <th scope="col">Date Cleared</th>
                <th scope="col" style={{ textAlign: "right" }}>Amount</th>
                <th scope="col" style={{ textAlign: "right" }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => {
                const invoice = p.invoiceId ? invoicesById.get(p.invoiceId) : undefined;
                const client = invoice ? clientsById.get(invoice.clientId) : undefined;
                const style = getMethodStyle(p.method);
                const voucherId = p.id ? `RCP-${String(p.id).slice(-6).toUpperCase()}` : "RCP-000000";

                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, color: "var(--c-text-3)", fontSize: 12 }}>{voucherId}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: "var(--c-text)" }}>{client?.name ?? "Client"}</div>
                      {client?.company && <div style={{ fontSize: 11, color: "var(--c-accent)" }}>{client.company}</div>}
                    </td>
                    <td>
                      {invoice ? (
                        <Link to={`/invoices/${invoice.id}`} style={{ fontWeight: 700 }}>
                          {invoice.number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "var(--radius-full)",
                          background: style.bg,
                          color: style.color,
                          border: `1px solid ${style.border}`,
                        }}
                      >
                        {style.icon} {p.method}
                      </span>
                    </td>
                    <td style={{ color: "var(--c-text-2)" }}>{p.date}</td>
                    <td className="money" style={{ textAlign: "right", fontWeight: 800, color: "var(--c-text)" }}>
                      {money.format(p.amount)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(p.id)}
                        className="btn btn-ghost"
                        style={{ padding: "4px 8px", fontSize: 11 }}
                      >
                        Receipt ↗
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Payment Modal with Sliding Card & OTP Verification */}
      <Modal
        open={modalOpen}
        title="Record Client Payment"
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form={FORM_ID} className="btn btn-primary" disabled={payable.length === 0} style={{ fontWeight: 700 }}>
              Confirm Payment
            </button>
          </>
        }
      >
        {payable.length === 0 ? (
          <p className="empty-state">All active client invoices have been settled in full!</p>
        ) : (
          <form id={FORM_ID} onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-field">
              <label htmlFor="payment-invoice">Select Client Invoice *</label>
              <select
                id="payment-invoice"
                value={invoiceId}
                onChange={(e) => {
                  setInvoiceId(e.target.value);
                  const inv = payable.find((i) => i.id === e.target.value);
                  if (inv) setAmount(String(invoiceBalance(inv, state.payments)));
                }}
              >
                {payable.map((i) => {
                  const client = clientsById.get(i.clientId);
                  const bal = invoiceBalance(i, state.payments);
                  return (
                    <option key={i.id} value={i.id}>
                      {`${i.number} (${client?.name ?? "Client"}) — Balance: ${money.format(bal)}`}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="payment-amount">Payment Amount ({state.settings.currency}) *</label>
              <input
                id="payment-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="payment-method">Payment Channel</label>
              <select
                id="payment-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Sliding Card details when method is Card */}
            {method === "Card" && (
              <div style={{ marginTop: 4 }}>
                <CardNumberInput />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="payment-date">Settlement Date</label>
              <input
                id="payment-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* 2-Factor OTP authorization toggle */}
            <div
              style={{
                padding: 12,
                borderRadius: "var(--radius)",
                background: "var(--c-surface-soft)",
                border: "1px solid var(--c-border)",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={enableOtp}
                  onChange={(e) => setEnableOtp(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--c-accent)" }}
                />
                <span>Authorize with 6-digit Security Code</span>
              </label>

              {enableOtp && (
                <div style={{ marginTop: 12 }}>
                  <OtpCodeInput label="Transaction Verification Code" helperText="Boxes fill one by one, then turn mint in a wave." />
                </div>
              )}
            </div>

            {shownError !== null && (
              <p className="field-error" role="alert">
                {shownError}
              </p>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
