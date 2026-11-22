import { useCallback, useId, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Card } from "../components/Card";
import { CategoryPieChart, EXPENSE_CATEGORY_COLORS, EXPENSE_CATEGORY_METADATA, type DonutDatum } from "../components/Charts";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from "../data/sampleData";
import { useStore } from "../services/store";


interface ExpenseForm {
  vendor: string;
  category: ExpenseCategory;
  amount: string;
  date: string;
  receiptName: string;
}

interface FormErrors {
  vendor?: string;
  amount?: string;
  date?: string;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyForm(): ExpenseForm {
  return {
    vendor: "",
    category: EXPENSE_CATEGORIES[0] ?? "Gear",
    amount: "",
    date: todayIso(),
    receiptName: "",
  };
}

function toCategory(value: string): ExpenseCategory | null {
  return EXPENSE_CATEGORIES.find((c) => c === value) ?? null;
}

function validate(form: ExpenseForm): FormErrors {
  const errors: FormErrors = {};
  if (form.vendor.trim() === "") {
    errors.vendor = "Vendor is required";
  }
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Amount must be a number greater than zero";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
    errors.date = "Enter a valid date";
  }
  return errors;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ExpensesPage() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const animate = !useReducedMotion(state.settings.reducedMotionOverride);

  const formatter = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: state.settings.currency }),
    [state.settings.currency],
  );

  const baseId = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [activeName, setActiveName] = useState<string | null>(null);

  const groups = useMemo(
    () =>
      EXPENSE_CATEGORIES.map((category) => {
        const items: Expense[] = state.expenses
          .filter((e) => e.category === category)
          .sort((a, b) => b.date.localeCompare(a.date));
        const total = items.reduce((sum, e) => sum + e.amount, 0);
        return { category, items, total };
      }).filter((g) => g.items.length > 0),
    [state.expenses],
  );

  const grandTotal = useMemo(() => groups.reduce((sum, g) => sum + g.total, 0), [groups]);

  const chartData = useMemo<DonutDatum[]>(
    () => groups.map((g) => ({ name: g.category, value: g.total })),
    [groups],
  );

  const openModal = () => {
    setForm(emptyForm());
    setErrors({});
    setOpen(true);
  };

  const closeModal = useCallback(() => setOpen(false), []);

  const setField = <K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = toCategory(event.target.value);
    if (next !== null) setField("category", next);
  };

  const handleReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setField("receiptName", file ? file.name : "");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    dispatch({
      type: "addExpense",
      expense: {
        date: form.date,
        category: form.category,
        vendor: form.vendor.trim(),
        amount: Number(form.amount),
        ...(form.receiptName !== "" ? { receipt: form.receiptName } : {}),
      },
    });
    toast.show("Expense added", "success");
    setOpen(false);
  };

  const formId = `${baseId}-expense-form`;
  const vendorId = `${baseId}-vendor`;
  const categoryId = `${baseId}-category`;
  const amountId = `${baseId}-amount`;
  const dateId = `${baseId}-date`;
  const receiptId = `${baseId}-receipt`;

  return (
    <div className="page expenses-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Total spent: {formatter.format(grandTotal)}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openModal}>
          Add expense
        </button>
      </header>

      <div className="expenses-layout">
        <Card title="By category">
          {chartData.length === 0 ? (
            <p className="muted">No expenses recorded yet.</p>
          ) : (
            <>
              <CategoryPieChart data={chartData} animate={animate} activeName={activeName} onHover={setActiveName} />
              <ul className="legend">
                {chartData.map((d) => {
                  const color = EXPENSE_CATEGORY_COLORS[d.name] ?? "#5A388C";
                  const meta = EXPENSE_CATEGORY_METADATA[d.name] ?? {
                    color,
                    colorName: "Theme Tint",
                    bgPastel: "rgba(90, 56, 140, 0.12)",
                  };
                  const pct = grandTotal > 0 ? Math.round((d.value / grandTotal) * 100) : 0;
                  const isActive = activeName === d.name;

                  return (
                    <li
                      key={d.name}
                      tabIndex={0}
                      className={"legend-item" + (isActive ? " is-active" : "")}
                      style={{
                        borderColor: isActive ? color : undefined,
                        boxShadow: isActive ? "0 4px 14px -2px " + color + "33" : undefined,
                      }}
                      onMouseEnter={() => setActiveName(d.name)}
                      onMouseLeave={() => setActiveName(null)}
                      onFocus={() => setActiveName(d.name)}
                      onBlur={() => setActiveName(null)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          className="legend-swatch"
                          aria-hidden="true"
                          style={{
                            background: color,
                            boxShadow: "0 0 0 2px #FFFFFF, 0 0 0 4px " + color,
                          }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--c-text)" }}>
                            {d.name}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: "0.03em",
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: meta.bgPastel,
                              color: color,
                            }}
                          >
                            {meta.colorName}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: meta.bgPastel,
                            color: color,
                          }}
                        >
                          {pct}%
                        </span>
                        <span className="legend-value">{formatter.format(d.value)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        <div className="expense-groups">
          {groups.length === 0 && (
            <Card>
              <p className="muted">Add your first expense to start tracking spending.</p>
            </Card>
          )}
          {groups.map((g) => {
            const color = EXPENSE_CATEGORY_COLORS[g.category] ?? "#5A388C";
            const meta = EXPENSE_CATEGORY_METADATA[g.category];
            const pct = grandTotal > 0 ? Math.round((g.total / grandTotal) * 100) : 0;
            return (
              <Card
                key={g.category}
                title={
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                    <span>{g.category}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: color,
                        background: meta?.bgPastel ?? "var(--c-surface-soft)",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      {pct}% · {meta?.colorName ?? "Category"}
                    </span>
                  </div>
                }
                action={<span className="expense-group-total" style={{ borderColor: color }}>{formatter.format(g.total)}</span>}
              >
                <ul className="expense-list">
                  {g.items.map((e) => (
                    <li key={e.id} className="expense-row">
                      <div className="expense-main">
                        <span className="expense-vendor">{e.vendor}</span>
                        <span className="expense-meta">
                          {formatDate(e.date)}
                          {e.receipt !== undefined && " · " + e.receipt}
                        </span>
                      </div>
                      <span className="expense-amount">{formatter.format(e.amount)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>

      <Modal
        open={open}
        title="Add expense"
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form={formId} className="btn btn-primary">
              Save expense
            </button>
          </>
        }
      >
        <form id={formId} className="form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor={vendorId}>Vendor</label>
            <input
              id={vendorId}
              type="text"
              value={form.vendor}
              aria-invalid={errors.vendor !== undefined}
              onChange={(e) => setField("vendor", e.target.value)}
            />
            {errors.vendor !== undefined && (
              <span className="field-error" role="alert">
                {errors.vendor}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor={categoryId}>Category</label>
            <select id={categoryId} value={form.category} onChange={handleCategoryChange}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor={amountId}>Amount</label>
            <input
              id={amountId}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.amount}
              aria-invalid={errors.amount !== undefined}
              onChange={(e) => setField("amount", e.target.value)}
            />
            {errors.amount !== undefined && (
              <span className="field-error" role="alert">
                {errors.amount}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor={dateId}>Date</label>
            <input
              id={dateId}
              type="date"
              value={form.date}
              aria-invalid={errors.date !== undefined}
              onChange={(e) => setField("date", e.target.value)}
            />
            {errors.date !== undefined && (
              <span className="field-error" role="alert">
                {errors.date}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor={receiptId}>Receipt</label>
            <input id={receiptId} type="file" onChange={handleReceiptChange} />
            {form.receiptName !== "" && <span className="muted">Selected: {form.receiptName}</span>}
          </div>
        </form>
      </Modal>
    </div>
  );
}
