import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../services/store";
import { useToast } from "./Toast";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { IconBell, IconMenu, IconPlus, IconSearch } from "./Icons";

export interface TopBarProps {
  onToggleSidebar: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  isSidebarCollapsed?: boolean;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0).slice(0, 2);
  const letters = words.map((word) => word.charAt(0).toUpperCase()).join("");
  return letters === "" ? "BZ" : letters;
}

const COMMON_SEARCH_SUGGESTIONS = [
  "invoices",
  "clients",
  "payments",
  "expenses",
  "wedding photography",
  "commercial portraits",
  "studio lighting",
  "overdue invoices",
  "draft",
  "forecast",
];

export function TopBar({ onToggleSidebar, query, onQueryChange, isSidebarCollapsed }: TopBarProps) {
  const { state } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Suggestions dynamic pool based on clients and sample searches
  const allSuggestions = [
    ...state.clients.map((c) => c.name),
    ...state.clients.map((c) => c.company).filter(Boolean),
    ...COMMON_SEARCH_SUGGESTIONS,
  ];

  // Ghost Complete logic
  const matchedGhost = query.trim()
    ? allSuggestions.find(
        (s) => s.toLowerCase().startsWith(query.toLowerCase()) && s.toLowerCase() !== query.toLowerCase()
      )
    : undefined;

  const ghostSuffix = matchedGhost ? matchedGhost.slice(query.length) : "";

  const acceptGhost = () => {
    if (matchedGhost) {
      onQueryChange(matchedGhost);
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Tab" || e.key === "ArrowRight") && matchedGhost) {
      e.preventDefault();
      acceptGhost();
    }
  };

  useEffect(() => {
    if (!notifOpen && !userOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(event.target)) setUserOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotifOpen(false);
        setUserOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown as any);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown as any);
    };
  }, [notifOpen, userOpen]);

  const businessName = state.settings.businessName;

  return (
    <header
      className="topbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 28px",
        position: "sticky",
        top: 0,
        zIndex: 40,
        height: "var(--topbar-h)",
      }}
    >
      {/* Collapsible Hamburger Menu Button */}
      <button
        type="button"
        className="topbar-menu"
        onClick={onToggleSidebar}
        aria-label={isSidebarCollapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}
        title="Toggle sidebar navigation"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: "var(--radius-sm)",
          background: "var(--c-surface-soft)",
          border: "1px solid var(--c-border)",
          cursor: "pointer",
          color: "var(--c-accent)",
          padding: 0,
          transition: "all 0.2s ease",
        }}
      >
        <IconMenu size={20} />
      </button>

      {/* Search Input with Inline Ghost Complete */}
      <div
        className="topbar-search"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flex: 1,
          maxWidth: 420,
          padding: "8px 14px",
          background: "var(--c-surface-soft)",
          borderRadius: "var(--radius-full)",
          border: "1.5px solid var(--c-border)",
          position: "relative",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        <span style={{ color: "var(--c-accent-2)", display: "inline-flex" }}>
          <IconSearch size={16} />
        </span>
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <input
            type="search"
            aria-label="Search clients and invoices"
            placeholder="Search clients, invoices or tags..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={{
              width: "100%",
              background: "transparent",
              border: 0,
              outline: "none",
              color: "var(--c-text)",
              fontSize: 13.5,
              fontWeight: 500,
              padding: 0,
            }}
          />

          {/* Ghost Completion Preview */}
          {ghostSuffix && (
            <div
              onClick={acceptGhost}
              title="Click or press Tab to autocomplete"
              style={{
                position: "absolute",
                right: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 8px",
                background: "var(--c-surface)",
                border: "1px solid var(--c-border)",
                borderRadius: "var(--radius-full)",
                color: "#8C849E",
                fontSize: 11.5,
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
                userSelect: "none",
              }}
            >
              <span>{ghostSuffix}</span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  background: "var(--c-accent)",
                  color: "#FFFFFF",
                  padding: "1px 5px",
                  borderRadius: 999,
                }}
              >
                Tab ⇥
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {/* Dark Mode Toggle Button with Broken Glass Transition */}
        <button
          type="button"
          onClick={(e) => toggleTheme(e)}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Switch to light mode (Broken Glass shatter)" : "Switch to dark mode (Broken Glass shatter)"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: "var(--radius-sm)",
            background: "var(--c-surface-soft)",
            border: "1px solid var(--c-border)",
            cursor: "pointer",
            color: "var(--c-accent)",
            padding: 0,
            transition: "all 0.2s ease",
            fontSize: 18,
          }}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        {/* Notifications Popover */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-label="Notifications"
            aria-haspopup="true"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen((open) => !open)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: "var(--radius-sm)",
              background: "var(--c-surface-soft)",
              border: "1px solid var(--c-border)",
              cursor: "pointer",
              color: "var(--c-accent)",
              padding: 0,
              position: "relative",
            }}
          >
            <IconBell size={18} />
            {state.notifications.some((n) => !n.read) && (
              <span
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--c-accent)",
                  boxShadow: "0 0 6px var(--c-accent)",
                }}
              />
            )}
          </button>

          {notifOpen && (
            <div
              className="dropdown dropdown-notifications"
              role="region"
              aria-label="Notifications list"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                width: 320,
                zIndex: 60,
                padding: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--c-border)",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <span>Notifications</span>
                <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>
                  {state.notifications.length} total
                </span>
              </div>
              {state.notifications.length === 0 ? (
                <p style={{ padding: 16, textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>
                  No notifications
                </p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: "4px 0", maxHeight: 300, overflowY: "auto" }}>
                  {state.notifications.map((n) => (
                    <li
                      key={n.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "var(--radius-sm)",
                        margin: "2px 0",
                        background: n.read ? "transparent" : "var(--c-surface-soft)",
                        fontSize: 13,
                        lineHeight: 1.4,
                      }}
                    >
                      <p style={{ margin: 0, color: "var(--c-text)" }}>{n.text}</p>
                      <time dateTime={n.date} style={{ fontSize: "0.75rem", color: "var(--c-text-3)", marginTop: 2, display: "block" }}>
                        {n.date}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* New Invoice Button */}
        <Link to="/invoices/new" className="btn btn-primary" style={{ gap: 6, fontWeight: 700 }}>
          <IconPlus size={16} />
          <span>New Invoice</span>
        </Link>

        {/* User Avatar Menu */}
        <div ref={userRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={userOpen}
            aria-label={`Account menu for ${businessName}`}
            onClick={() => setUserOpen((open) => !open)}
            className="avatar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: "2px solid var(--c-border)",
              cursor: "pointer",
              background: "linear-gradient(135deg, var(--c-accent) 0%, var(--c-accent-2) 100%)",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 13,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {initialsOf(businessName)}
          </button>

          {userOpen && (
            <div
              className="dropdown dropdown-user"
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                minWidth: 200,
                zIndex: 60,
                padding: 6,
              }}
            >
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--c-border)" }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "var(--c-text)" }}>
                  {profile?.businessName || businessName}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--c-text-3)" }}>
                  {user?.email || "Studio Account"}
                </p>
              </div>
              <Link
                to="/settings"
                role="menuitem"
                onClick={() => setUserOpen(false)}
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--c-text)",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Settings & Security
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  setUserOpen(false);
                  await signOut();
                  toast.show("Signed out of Bizora.", "info");
                  navigate("/auth");
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  color: "var(--c-accent)",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
