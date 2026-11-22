import { useRef, useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import {
  IconChevron,
  IconClients,
  IconDashboard,
  IconExpenses,
  IconForecast,
  IconInvoice,
  IconPayments,
  IconSettings,
  type IconProps,
} from "./Icons";

export interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { to: "/clients", label: "Clients", icon: IconClients },
  { to: "/invoices", label: "Invoices", icon: IconInvoice },
  { to: "/payments", label: "Payments", icon: IconPayments },
  { to: "/expenses", label: "Expenses", icon: IconExpenses },
  { to: "/forecast", label: "Cash Forecast", icon: IconForecast },
  { to: "/settings", label: "Settings", icon: IconSettings },
];

const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function Sidebar({ collapsed, mobileOpen, onToggleCollapse, onCloseMobile }: SidebarProps) {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [cometTop, setCometTop] = useState<number | null>(null);
  const [isStreaking, setIsStreaking] = useState(false);

  // Animate the Glowing Comet Streak whenever active route changes
  useEffect(() => {
    if (!navRef.current) return;
    const activeLink = navRef.current.querySelector<HTMLElement>(".nav-link.active");
    if (activeLink) {
      const navRect = navRef.current.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      const targetTop = linkRect.top - navRect.top;

      setIsStreaking(true);
      setCometTop(targetTop);

      const timer = setTimeout(() => {
        setIsStreaking(false);
      }, 550);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, collapsed]);

  const className = ["sidebar", collapsed ? "collapsed" : "", mobileOpen ? "open" : ""]
    .filter((part) => part !== "")
    .join(" ");

  return (
    <aside className={className}>
      {/* Sidebar Header with Branded Logo & Collapse Toggle */}
      <div
        className="sidebar-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8,
          padding: collapsed ? "18px 8px" : "18px 16px",
          borderBottom: "1px solid var(--c-border)",
          transition: "padding 0.3s ease",
        }}
      >
        <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
          {collapsed ? <Logo variant="mark" size={30} /> : <Logo variant="full" size={30} />}
        </div>
        {!collapsed && (
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm)",
              background: "var(--c-surface-soft)",
              border: "1px solid var(--c-border)",
              cursor: "pointer",
              color: "var(--c-accent)",
              transition: "all 0.2s ease",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                transform: "rotate(180deg)",
                transition: "transform 0.25s ease",
              }}
            >
              <IconChevron size={18} />
            </span>
          </button>
        )}
      </div>

      {/* Main Nav with Glowing Comet Indicator */}
      <nav ref={navRef} aria-label="Main navigation" style={{ padding: "12px 10px", position: "relative" }}>
        {/* The Glowing Comet that streaks to the new tab, leaving a fading tail */}
        {cometTop !== null && (
          <div
            className={`comet-streak-nav ${isStreaking ? "streaking" : ""}`}
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              top: cometTop,
              height: 44,
              borderRadius: "var(--radius-sm)",
              background: "var(--c-surface-soft)",
              boxShadow: isStreaking
                ? "0 0 16px rgba(136, 124, 199, 0.45), 0 2px 8px rgba(90, 59, 188, 0.15)"
                : "none",
              pointerEvents: "none",
              zIndex: 1,
              transition: "top 0.4s cubic-bezier(0.2, 0.9, 0.25, 1), box-shadow 0.35s ease",
            }}
          >
            {/* Comet Head Glowing Orb */}
            <span
              style={{
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
                width: 4,
                height: 24,
                borderRadius: "0 4px 4px 0",
                background: "var(--c-accent)",
                boxShadow: "0 0 10px 2px var(--c-accent)",
                opacity: 1,
              }}
            />
            {/* Fading Tail of Light */}
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                background: "linear-gradient(90deg, rgba(136, 124, 199, 0.25) 0%, rgba(253, 235, 250, 0.8) 40%, transparent 100%)",
                opacity: isStreaking ? 1 : 0.4,
                transition: "opacity 0.45s ease",
              }}
            />
          </div>
        )}

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6, position: "relative", zIndex: 2 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  onClick={onCloseMobile}
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    height: 44,
                    borderRadius: "var(--radius-sm)",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    position: "relative",
                    zIndex: 2,
                    justifyContent: collapsed ? "center" : "flex-start",
                  }}
                >
                  <Icon size={20} />
                  <span style={collapsed ? VISUALLY_HIDDEN : { fontWeight: 500, fontSize: 13.5 }}>
                    {item.label}
                  </span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* When collapsed, a quick expand button at the bottom */}
      {collapsed && (
        <div style={{ padding: "12px", textAlign: "center" }}>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
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
              margin: "0 auto",
            }}
          >
            <IconChevron size={18} />
          </button>
        </div>
      )}
    </aside>
  );
}
