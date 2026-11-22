import { useState, type FormEvent } from "react";
import { Card } from "../components/Card";
import { Logo } from "../components/Logo";
import { useToast } from "../components/Toast";
import { useTheme } from "../context/ThemeContext";
import { useStore } from "../services/store";
import type { Settings } from "../data/sampleData";
import {
  CometTabBar,
  PasswordStrengthMeter,
  OtpCodeInput,
  CardNumberInput,
  AutoGrowNote,
  TagInput,
  GhostInput,
} from "../components/InteractiveMicroWidgets";

type TabId = "profile" | "invoicing" | "notifications" | "security" | "appearance";

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: readonly TabDef[] = [
  { id: "profile", label: "Business profile" },
  { id: "invoicing", label: "Invoicing defaults" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security & Micro-Widgets" },
  { id: "appearance", label: "Appearance & Theme" },
];

const CURRENCIES: readonly string[] = ["USD", "EUR", "GBP"];

export function SettingsPage() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
  const [draft, setDraft] = useState<Settings>(state.settings);
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // Demonstration state for micro-interactions
  const [demoNote, setDemoNote] = useState(
    "Bizora Photography Studio\nAll shoots include high-resolution color-graded deliverable files.\nTurnaround time is 5 business days."
  );
  const [demoTags, setDemoTags] = useState<string[]>(["Commercial", "Studio", "Fashion", "Lighting"]);
  const [demoGhostText, setDemoGhostText] = useState("");

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch({ type: "updateSettings", settings: draft });
    toast.show("Studio settings saved successfully", "success");
  };

  return (
    <div className="page settings-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings & Studio Preferences</h1>
          <p className="page-subtitle">
            Configure your photography studio profile, billing defaults, notifications, and security.
          </p>
        </div>
      </header>

      {/* Glowing Comet Tab Bar */}
      <div style={{ marginBottom: 8 }}>
        <CometTabBar
          tabs={TABS}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
        />
      </div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {activeTab === "profile" && (
          <div role="tabpanel" id="settings-panel-profile" aria-labelledby="settings-tab-profile">
            <Card title="Business Profile">
              <div
                className="settings-brand"
                style={{
                  padding: "16px 20px",
                  background: "var(--c-surface-soft)",
                  borderRadius: "var(--radius)",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1px solid var(--c-border)",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-2)", fontWeight: 600 }}>
                    Studio Brand Identity
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--c-text-3)" }}>
                    Appears on printable invoices, client emails, and gallery deliveries
                  </p>
                </div>
                <Logo variant="full" size={42} />
              </div>

              <div className="form-field">
                <label htmlFor="settings-business-name">Business Name</label>
                <input
                  id="settings-business-name"
                  type="text"
                  value={draft.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="settings-address">Studio Address</label>
                <textarea
                  id="settings-address"
                  rows={2}
                  value={draft.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="settings-tax-number">Tax / VAT Registration ID</label>
                <input
                  id="settings-tax-number"
                  type="text"
                  value={draft.taxNumber}
                  onChange={(e) => update("taxNumber", e.target.value)}
                />
              </div>
            </Card>
          </div>
        )}

        {activeTab === "invoicing" && (
          <div role="tabpanel" id="settings-panel-invoicing" aria-labelledby="settings-tab-invoicing">
            <Card title="Invoicing Defaults">
              <div className="form-field">
                <label htmlFor="settings-currency">Base Currency</label>
                <select
                  id="settings-currency"
                  value={draft.currency}
                  onChange={(e) => update("currency", e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="settings-invoice-prefix">Invoice Number Prefix</label>
                <input
                  id="settings-invoice-prefix"
                  type="text"
                  value={draft.invoicePrefix}
                  onChange={(e) => update("invoicePrefix", e.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="settings-next-invoice-number">Next Invoice Counter</label>
                <input
                  id="settings-next-invoice-number"
                  type="number"
                  min={1}
                  value={draft.nextInvoiceNumber}
                  onChange={(e) => update("nextInvoiceNumber", Number(e.target.value))}
                />
              </div>

              <div className="form-field">
                <label htmlFor="settings-payment-terms">Default Payment Terms (days)</label>
                <input
                  id="settings-payment-terms"
                  type="number"
                  min={0}
                  value={draft.paymentTermsDays}
                  onChange={(e) => update("paymentTermsDays", Number(e.target.value))}
                />
              </div>

              <div className="form-field">
                <label htmlFor="settings-default-tax-rate">Default Tax Rate (%)</label>
                <input
                  id="settings-default-tax-rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={draft.defaultTaxRate}
                  onChange={(e) => update("defaultTaxRate", Number(e.target.value))}
                />
              </div>
            </Card>
          </div>
        )}

        {activeTab === "notifications" && (
          <div role="tabpanel" id="settings-panel-notifications" aria-labelledby="settings-tab-notifications">
            <Card title="Notification Preferences">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
                  <input
                    id="settings-notify-payment-received"
                    type="checkbox"
                    checked={draft.notifyPaymentReceived}
                    onChange={(e) => update("notifyPaymentReceived", e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "var(--c-accent)" }}
                  />
                  <span>Send instant notification when payment is received</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
                  <input
                    id="settings-notify-overdue"
                    type="checkbox"
                    checked={draft.notifyOverdue}
                    onChange={(e) => update("notifyOverdue", e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "var(--c-accent)" }}
                  />
                  <span>Alert me when invoices become overdue past payment terms</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
                  <input
                    id="settings-notify-shoot-reminders"
                    type="checkbox"
                    checked={draft.notifyShootReminders}
                    onChange={(e) => update("notifyShootReminders", e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "var(--c-accent)" }}
                  />
                  <span>Receive 24-hour shoot calendar preparation reminders</span>
                </label>
              </div>
            </Card>
          </div>
        )}

        {/* Security & Micro-Interactions Showcase Tab */}
        {activeTab === "security" && (
          <div role="tabpanel" id="settings-panel-security" aria-labelledby="settings-tab-security" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="grid-two">
              {/* 1. Four-Step Password Strength Meter */}
              <Card title="Password Security">
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--c-text-2)" }}>
                  Dynamic four-step meter that fills and recolors as your password grows in complexity.
                </p>
                <PasswordStrengthMeter
                  label="Studio Master Password"
                  onPasswordChange={() => {
                    // Handled internally in widget
                  }}
                />
              </Card>

              {/* 2. OTP Code Boxes (fills one by one then turns mint in a wave) */}
              <Card title="2FA & Verification Code">
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--c-text-2)" }}>
                  Six code boxes fill one by one, then turn mint in an animated wave on completion.
                </p>
                <OtpCodeInput
                  length={6}
                  label="Authentication Code"
                  onComplete={(code) => {
                    toast.show(`Code ${code} verified! Mint wave activated.`, "success");
                  }}
                />
              </Card>
            </div>

            <div className="grid-two">
              {/* 3. Card Number Formatter with Sliding Expiry */}
              <Card title="Credit Card Processing">
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--c-text-2)" }}>
                  Card digits group automatically as you type, then the expiration & CVC fields slide in.
                </p>
                <CardNumberInput />
              </Card>

              {/* 4. Ghost Complete Input */}
              <Card title="Ghost Complete Input">
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--c-text-2)" }}>
                  A gray ghost completion appears inline ahead of your cursor; tap it or press Tab to fill in.
                </p>
                <GhostInput
                  label="Quick Autocomplete Search"
                  value={demoGhostText}
                  onChange={setDemoGhostText}
                  suggestions={["Vogue Magazine", "Elena Rostova", "Sunset Beach Wedding", "Commercial Catalog", "Studio Session"]}
                  placeholder="Type 'Vog', 'Ele', 'Sun'..."
                />
              </Card>
            </div>

            <div className="grid-two">
              {/* 5. Auto Grow Note Field */}
              <Card title="Auto-Grow Note Field">
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--c-text-2)" }}>
                  The note field grows smoothly a line at a time with a soft spring transition.
                </p>
                <AutoGrowNote
                  label="Studio Instructions & Delivery Terms"
                  value={demoNote}
                  onChange={setDemoNote}
                  minRows={3}
                />
              </Card>

              {/* 6. Tag Input with Popping Chips */}
              <Card title="Tag Input with Popping Chips">
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--c-text-2)" }}>
                  Each typed word pops into an interactive chip that you can remove with the '×' button.
                </p>
                <TagInput
                  tags={demoTags}
                  onChange={setDemoTags}
                  label="Photography Specialties"
                  placeholder="Type word and press Space or Enter..."
                />
              </Card>
            </div>
          </div>
        )}

        {activeTab === "appearance" && (
          <div role="tabpanel" id="settings-panel-appearance" aria-labelledby="settings-tab-appearance">
            <Card title="Workspace Theme & Broken Glass Transition">
              <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--c-text-2)" }}>
                Toggle between Light Lavender and Dark Obsidian modes with a high-fidelity broken glass workspace shatter interference.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => toggleTheme(e)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px" }}
                >
                  <span>{theme === "dark" ? "☀️ Switch to Light Mode" : "🌙 Switch to Dark Mode"}</span>
                </button>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-2)" }}>
                  Current active mode: <strong style={{ color: "var(--c-accent)", textTransform: "capitalize" }}>{theme} Theme</strong>
                </span>
              </div>
            </Card>

            <div style={{ height: 16 }} />

            <Card title="Appearance & Palette">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "#F8F7FC", border: "1px solid #E6E0F0" }}>
                  <div style={{ width: "100%", height: 32, borderRadius: 6, background: "#F8F7FC", border: "1px solid #E6E0F0", marginBottom: 6 }} />
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#241C38" }}>App Base</p>
                  <p style={{ margin: 0, fontSize: 10, color: "#8C849E" }}>#F8F7FC</p>
                </div>

                <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "#FFFFFF", border: "1px solid #E6E0F0" }}>
                  <div style={{ width: "100%", height: 32, borderRadius: 6, background: "#FFFFFF", border: "1px solid #E6E0F0", marginBottom: 6 }} />
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#241C38" }}>Card Surface</p>
                  <p style={{ margin: 0, fontSize: 10, color: "#8C849E" }}>#FFFFFF</p>
                </div>

                <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "#FFFFFF", border: "1px solid #E6E0F0" }}>
                  <div style={{ width: "100%", height: 32, borderRadius: 6, background: "#FDEBFA", border: "1px solid #E6E0F0", marginBottom: 6 }} />
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#241C38" }}>Lavender Soft</p>
                  <p style={{ margin: 0, fontSize: 10, color: "#8C849E" }}>#FDEBFA</p>
                </div>

                <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "#FFFFFF", border: "1px solid #E6E0F0" }}>
                  <div style={{ width: "100%", height: 32, borderRadius: 6, background: "#5A3BBC", marginBottom: 6 }} />
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#241C38" }}>Primary Purple</p>
                  <p style={{ margin: 0, fontSize: 10, color: "#8C849E" }}>#5A3BBC</p>
                </div>

                <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "#FFFFFF", border: "1px solid #E6E0F0" }}>
                  <div style={{ width: "100%", height: 32, borderRadius: 6, background: "#887CC7", marginBottom: 6 }} />
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#241C38" }}>Interactive</p>
                  <p style={{ margin: 0, fontSize: 10, color: "#8C849E" }}>#887CC7</p>
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
                <input
                  id="settings-reduced-motion"
                  type="checkbox"
                  checked={draft.reducedMotionOverride}
                  onChange={(e) => update("reducedMotionOverride", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--c-accent)" }}
                />
                <span>Enable Reduced Motion (disables chart animations and spring transitions)</span>
              </label>
            </Card>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="submit" className="btn btn-primary" style={{ fontWeight: 700, padding: "10px 24px" }}>
            Save Studio Settings
          </button>
        </div>
      </form>
    </div>
  );
}
