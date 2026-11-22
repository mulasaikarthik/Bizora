import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { useSearchQuery } from "../components/Layout";
import { IconPlus, IconTrash } from "../components/Icons";
import { Modal } from "../components/Modal";
import { SkeletonCards } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import type { Client } from "../data/sampleData";
import { invoiceBalance, invoiceTotals, loadSample, useStore } from "../services/store";
import { CometTabBar, GhostInput, TagInput } from "../components/InteractiveMicroWidgets";

type ViewMode = "cards" | "table";
type StatusFilter = "all" | "open" | "settled";

interface ClientForm {
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  tags: string[];
}

type FormErrors = Partial<Record<keyof ClientForm, string>>;

const EMPTY_FORM: ClientForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  address: "",
  tags: ["Commercial"],
};

const DEFAULT_TAGS_BY_INDEX = [
  ["Wedding", "VIP"],
  ["Commercial", "Studio"],
  ["Editorial", "Fashion"],
  ["Portraits", "Corporate"],
  ["Events", "Product"],
  ["FineArt"],
];

const PRESET_SPECIALTIES = ["All", "Wedding", "Commercial", "Studio", "Editorial", "Portraits", "VIP"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeMoney(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Generate pleasing consistent gradient for client avatars
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #5A3BBC 0%, #887CC7 100%)",
  "linear-gradient(135deg, #6366F1 0%, #A855F7 100%)",
  "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
  "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)",
  "linear-gradient(135deg, #7E68C8 0%, #B5A8E0 100%)",
  "linear-gradient(135deg, #4A2B99 0%, #887CC7 100%)",
];

export function ClientsPage() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const globalQuery = useSearchQuery().trim().toLowerCase();
  const money = useMemo(() => makeMoney(state.settings.currency), [state.settings.currency]);

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("cards");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTag, setSelectedTag] = useState<string>("All");
  const [localSearch, setLocalSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);

  // Client tags mapping stored locally for interactive chip experience
  const [clientTags, setClientTags] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;
    loadSample().then(() => {
      if (active) {
        setLoading(false);
        // Seed initial tags
        const initialMap: Record<string, string[]> = {};
        state.clients.forEach((c, idx) => {
          initialMap[c.id] = DEFAULT_TAGS_BY_INDEX[idx % DEFAULT_TAGS_BY_INDEX.length] || ["Creative"];
        });
        setClientTags(initialMap);
      }
    });
    return () => {
      active = false;
    };
  }, [state.clients]);

  /* Calculate per-client stats */
  const stats = useMemo(() => {
    const map = new Map<string, { count: number; totalBilled: number; outstanding: number; paid: number }>();
    for (const client of state.clients) {
      const invoices = state.invoices.filter((i) => i.clientId === client.id);
      let totalBilled = 0;
      let outstanding = 0;
      for (const inv of invoices) {
        const invTotal = invoiceTotals(inv).total;
        totalBilled += invTotal;
        if (inv.status !== "Draft") {
          outstanding += invoiceBalance(inv, state.payments);
        }
      }
      const paid = Math.max(0, totalBilled - outstanding);
      map.set(client.id, { count: invoices.length, totalBilled, outstanding, paid });
    }
    return map;
  }, [state.clients, state.invoices, state.payments]);

  // Overall KPI statistics
  const totalBilledAll = useMemo(() => {
    return Array.from(stats.values()).reduce((sum, s) => sum + s.totalBilled, 0);
  }, [stats]);

  const totalOutstandingAll = useMemo(() => {
    return Array.from(stats.values()).reduce((sum, s) => sum + s.outstanding, 0);
  }, [stats]);

  const avgClientValue = state.clients.length > 0 ? Math.round(totalBilledAll / state.clients.length) : 0;

  // Filter clients
  const visibleClients = useMemo(() => {
    const activeSearch = (localSearch || globalQuery).toLowerCase();
    return state.clients.filter((client) => {
      const stat = stats.get(client.id) ?? { count: 0, totalBilled: 0, outstanding: 0, paid: 0 };
      if (statusFilter === "open" && stat.outstanding <= 0) return false;
      if (statusFilter === "settled" && stat.outstanding > 0) return false;

      const tags = clientTags[client.id] || [];
      if (selectedTag !== "All" && !tags.includes(selectedTag)) return false;

      if (activeSearch) {
        const matchesName = client.name.toLowerCase().includes(activeSearch);
        const matchesCompany = client.company.toLowerCase().includes(activeSearch);
        const matchesEmail = client.email.toLowerCase().includes(activeSearch);
        const matchesTag = tags.some((t) => t.toLowerCase().includes(activeSearch));
        if (!matchesName && !matchesCompany && !matchesEmail && !matchesTag) return false;
      }

      return true;
    });
  }, [state.clients, stats, statusFilter, selectedTag, localSearch, globalQuery, clientTags]);

  const clientNameSuggestions = state.clients.map((c) => c.name);

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: FormErrors = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!EMAIL_PATTERN.test(form.email.trim())) newErrors.email = "Enter a valid email address";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload: Omit<Client, "id"> = {
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    };

    dispatch({ type: "addClient", client: payload });
    toast.show(`${form.name} added to your client roster!`, "success");
    setAddOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    dispatch({ type: "deleteClient", id: pendingDelete.id });
    toast.show(`${pendingDelete.name} was removed.`, "info");
    setPendingDelete(null);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.show(`${label} copied to clipboard!`, "info");
  };

  return (
    <div className="page clients-page">
      {/* Page Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">Client Roster</h1>
          <p className="page-subtitle">
            Manage your photography clients, projects, agreements and billing balances.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAddOpen(true)}
            style={{ fontWeight: 700, gap: 8, padding: "10px 20px" }}
          >
            <IconPlus size={18} />
            <span>Add New Client</span>
          </button>
        </div>
      </header>

      {/* KPI Summary Banner */}
      <div className="grid-kpi">
        <div className="card" style={{ background: "var(--c-surface)" }}>
          <p style={{ fontSize: 13, color: "var(--c-text-2)", fontWeight: 600, margin: 0 }}>
            Total Active Clients
          </p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--c-text)" }}>
              {state.clients.length}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--c-accent)",
                background: "var(--c-surface-soft)",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
              }}
            >
              100% Retained
            </span>
          </div>
        </div>

        <div className="card" style={{ background: "var(--c-surface)" }}>
          <p style={{ fontSize: 13, color: "var(--c-text-2)", fontWeight: 600, margin: 0 }}>
            Outstanding Invoices
          </p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: totalOutstandingAll > 0 ? "var(--c-warning)" : "var(--c-mint)" }}>
              {money.format(totalOutstandingAll)}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--c-accent)",
                background: "rgba(245, 158, 11, 0.15)",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
              }}
            >
              Awaiting
            </span>
          </div>
        </div>

        <div className="card" style={{ background: "var(--c-surface)" }}>
          <p style={{ fontSize: 13, color: "var(--c-text-2)", fontWeight: 600, margin: 0 }}>
            Total Revenue Billed
          </p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--c-accent)" }}>
              {money.format(totalBilledAll)}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--c-mint)",
                background: "rgba(16, 185, 129, 0.14)",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
              }}
            >
              +14% YoY
            </span>
          </div>
        </div>

        <div className="card" style={{ background: "var(--c-surface)" }}>
          <p style={{ fontSize: 13, color: "var(--c-text-2)", fontWeight: 600, margin: 0 }}>
            Avg. Client Lifetime
          </p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--c-text)" }}>
              {money.format(avgClientValue)}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--c-accent-2)",
                background: "var(--c-surface-soft)",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
              }}
            >
              Per account
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar with Glowing Comet Tab Bar & Ghost Search */}
      <div
        className="card"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 16,
          background: "var(--c-surface)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Status Filter Comet Tab Bar */}
          <CometTabBar
            tabs={[
              { id: "all", label: "All Clients", badge: state.clients.length },
              {
                id: "open",
                label: "Has Balance",
                badge: state.clients.filter((c) => (stats.get(c.id)?.outstanding ?? 0) > 0).length,
              },
              {
                id: "settled",
                label: "Fully Settled",
                badge: state.clients.filter((c) => (stats.get(c.id)?.outstanding ?? 0) === 0).length,
              },
            ]}
            activeId={statusFilter}
            onChange={(id) => setStatusFilter(id as StatusFilter)}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Ghost Search input */}
            <div style={{ minWidth: 260 }}>
              <GhostInput
                value={localSearch}
                onChange={setLocalSearch}
                suggestions={clientNameSuggestions}
                placeholder="Search name, company, email..."
              />
            </div>

            {/* View Mode Switcher with Comet Tab Bar */}
            <CometTabBar
              tabs={[
                { id: "cards", label: "Cards View" },
                { id: "table", label: "Table View" },
              ]}
              activeId={view}
              onChange={(id) => setView(id as ViewMode)}
            />
          </div>
        </div>

        {/* Specialty Filter Chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", marginRight: 4 }}>
            Specialty:
          </span>
          {PRESET_SPECIALTIES.map((spec) => {
            const isSelected = selectedTag === spec;
            return (
              <button
                key={spec}
                type="button"
                onClick={() => setSelectedTag(spec)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 12px",
                  borderRadius: "var(--radius-full)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: isSelected ? "var(--c-accent)" : "var(--c-surface-soft)",
                  color: isSelected ? "#FFFFFF" : "var(--c-text-2)",
                  border: isSelected ? "1px solid var(--c-accent)" : "1px solid var(--c-border)",
                  transition: "all 0.2s ease",
                  boxShadow: isSelected ? "0 2px 6px rgba(90, 59, 188, 0.25)" : "none",
                }}
              >
                #{spec}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Client Content */}
      {loading ? (
        <SkeletonCards count={6} />
      ) : visibleClients.length === 0 ? (
        <Card>
          <EmptyState
            title="No clients found"
            text={
              localSearch || globalQuery || selectedTag !== "All"
                ? "No clients matched your active filter criteria."
                : "You haven't added any clients yet. Start by onboarding your first photography client."
            }
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setLocalSearch("");
                  setSelectedTag("All");
                  setStatusFilter("all");
                }}
              >
                Reset Filters
              </button>
            }
          />
        </Card>
      ) : view === "cards" ? (
        /* Rich Interactive Cards View */
        <div className="grid-3">
          {visibleClients.map((client, index) => {
            const stat = stats.get(client.id) ?? { count: 0, totalBilled: 0, outstanding: 0, paid: 0 };
            const tags = clientTags[client.id] || ["Commercial"];
            const avatarGrad = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
            const hasBalance = stat.outstanding > 0;
            const paidPct = stat.totalBilled > 0 ? Math.round((stat.paid / stat.totalBilled) * 100) : 100;

            return (
              <div
                key={client.id}
                className="card card-hover"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  padding: 22,
                  background: "var(--c-surface)",
                  borderRadius: "var(--radius-lg)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Top Client Header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  {/* Distinct Avatar */}
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      background: avatarGrad,
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 18,
                      letterSpacing: "0.02em",
                      flexShrink: 0,
                      boxShadow: "0 4px 12px rgba(90, 59, 188, 0.2)",
                    }}
                  >
                    {initialsOf(client.name)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <Link
                        to={`/clients/${client.id}`}
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: "var(--c-text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {client.name}
                      </Link>
                      {hasBalance ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "var(--radius-full)",
                            background: "rgba(245, 158, 11, 0.12)",
                            color: "var(--c-accent)",
                            border: "1px solid rgba(245, 158, 11, 0.25)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Balance Due
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "var(--radius-full)",
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "var(--c-text-2)",
                            border: "1px solid rgba(16, 185, 129, 0.25)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Settled
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--c-accent)", fontWeight: 600 }}>
                      {client.company || "Independent Client"}
                    </p>
                  </div>
                </div>

                {/* Contact Pills */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--c-text-2)" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      ✉ {client.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(client.email, "Email")}
                      style={{
                        background: "none",
                        border: 0,
                        color: "var(--c-accent-2)",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  {client.phone && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--c-text-2)" }}>
                      <span>☎ {client.phone}</span>
                      <a href={`tel:${client.phone}`} style={{ fontSize: 11, fontWeight: 600 }}>
                        Call
                      </a>
                    </div>
                  )}
                </div>

                {/* Tags Section with Animated Chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="pop-chip"
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        background: "var(--c-surface-soft)",
                        color: "var(--c-accent)",
                        border: "1px solid var(--c-border)",
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>

                {/* Financial Health Progress */}
                <div
                  style={{
                    padding: 12,
                    background: "var(--c-surface-soft)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
                    <span style={{ color: "var(--c-text-2)" }}>Lifetime Invoiced</span>
                    <span style={{ color: "var(--c-text)" }}>{money.format(stat.totalBilled)}</span>
                  </div>

                  {/* Progress Bar */}
                  <div
                    style={{
                      height: 6,
                      background: "rgba(230, 224, 240, 0.8)",
                      borderRadius: "var(--radius-full)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${paidPct}%`,
                        height: "100%",
                        background: hasBalance ? "var(--c-accent)" : "var(--c-mint)",
                        borderRadius: "inherit",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--c-text-3)" }}>
                      {stat.count} {stat.count === 1 ? "invoice" : "invoices"}
                    </span>
                    <span style={{ fontWeight: 700, color: hasBalance ? "var(--c-accent)" : "var(--c-text-2)" }}>
                      {hasBalance ? `${money.format(stat.outstanding)} due` : "Fully paid"}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 4 }}>
                  <Link
                    to={`/clients/${client.id}`}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}
                  >
                    View Dossier
                  </Link>
                  <Link
                    to={`/invoices/new?clientId=${client.id}`}
                    className="btn btn-primary"
                    style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 12px" }}
                    title="Draft invoice for this client"
                  >
                    Invoice
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label={`Delete ${client.name}`}
                    onClick={() => setPendingDelete(client)}
                    style={{ padding: 8, color: "var(--c-text-3)" }}
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Enhanced Pro Data Table */
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Client & Studio</th>
                <th scope="col">Specialties</th>
                <th scope="col">Contact</th>
                <th scope="col">Invoices</th>
                <th scope="col">Total Invoiced</th>
                <th scope="col">Outstanding</th>
                <th scope="col">Status</th>
                <th scope="col" style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleClients.map((client, index) => {
                const stat = stats.get(client.id) ?? { count: 0, totalBilled: 0, outstanding: 0, paid: 0 };
                const tags = clientTags[client.id] || ["Commercial"];
                const avatarGrad = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
                const hasBalance = stat.outstanding > 0;

                return (
                  <tr key={client.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            background: avatarGrad,
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {initialsOf(client.name)}
                        </div>
                        <div>
                          <Link to={`/clients/${client.id}`} style={{ fontWeight: 700, color: "var(--c-text)" }}>
                            {client.name}
                          </Link>
                          <p style={{ margin: 0, fontSize: 12, color: "var(--c-accent)" }}>
                            {client.company || "Independent"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {tags.map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: 11,
                              padding: "1px 7px",
                              borderRadius: "var(--radius-full)",
                              background: "var(--c-surface-soft)",
                              color: "var(--c-accent)",
                              fontWeight: 600,
                            }}
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>
                        <div>{client.email}</div>
                        {client.phone && <div style={{ color: "var(--c-text-3)", fontSize: 11 }}>{client.phone}</div>}
                      </div>
                    </td>

                    <td style={{ fontWeight: 600 }}>{stat.count}</td>

                    <td className="money" style={{ fontWeight: 700 }}>
                      {money.format(stat.totalBilled)}
                    </td>

                    <td className="money" style={{ fontWeight: 700, color: hasBalance ? "var(--c-accent)" : "var(--c-text-2)" }}>
                      {money.format(stat.outstanding)}
                    </td>

                    <td>
                      {hasBalance ? (
                        <span className="status-badge status-open">Open Balance</span>
                      ) : (
                        <span className="status-badge status-paid">Settled</span>
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Link to={`/clients/${client.id}`} className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }}>
                          View
                        </Link>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setPendingDelete(client)}
                          style={{ padding: 6, color: "var(--c-text-3)" }}
                        >
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Client Modal */}
      <Modal
        open={addOpen}
        title="Onboard New Photography Client"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="add-client-form" className="btn btn-primary" style={{ fontWeight: 700 }}>
              Save & Onboard
            </button>
          </>
        }
      >
        <form
          id="add-client-form"
          noValidate
          onSubmit={handleAddSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div className="form-field">
            <label htmlFor="ac-name">Client Name *</label>
            <input
              id="ac-name"
              type="text"
              required
              placeholder="e.g. Elena Rostova"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="ac-company">Company / Publication</label>
            <input
              id="ac-company"
              type="text"
              placeholder="e.g. Vogue Studios or Horizon Media"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="ac-email">Contact Email *</label>
            <input
              id="ac-email"
              type="email"
              required
              placeholder="client@domain.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="ac-phone">Phone Number</label>
            <input
              id="ac-phone"
              type="tel"
              placeholder="+1 (555) 234-5678"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="ac-address">Studio / Billing Address</label>
            <input
              id="ac-address"
              type="text"
              placeholder="123 Arts District, Suite 400"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          {/* Interactive Tag Input Component */}
          <TagInput
            tags={form.tags}
            onChange={(tags) => setForm({ ...form, tags })}
            label="Specialty Tags (press Space or Enter to pop chip)"
            placeholder="e.g. Wedding, Commercial, Drone..."
          />
        </form>
      </Modal>

      {/* Delete Client Modal */}
      <Modal
        open={pendingDelete !== null}
        title="Remove Client from Roster?"
        onClose={() => setPendingDelete(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setPendingDelete(null)}>
              Keep Client
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmDelete} style={{ background: "var(--c-danger)", borderColor: "var(--c-danger)" }}>
              Confirm Delete
            </button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 14, color: "var(--c-text)", lineHeight: 1.6 }}>
          Are you sure you want to remove <strong>{pendingDelete?.name}</strong>? Their past invoices and financial payment histories will remain safely preserved in your business ledger.
        </p>
      </Modal>
    </div>
  );
}
