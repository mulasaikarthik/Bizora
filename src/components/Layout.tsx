import { useEffect, useState } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ErrorBoundary } from "./ErrorBoundary";

const SIDEBAR_STORAGE_KEY = "bizora.sidebarCollapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
      // Storage unavailable
    }
  }, [collapsed]);

  // Handler for collapsible hamburger menu (handles both desktop collapse and mobile drawer)
  const handleToggleSidebar = () => {
    if (window.innerWidth < 768) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  };

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {mobileOpen && (
        <div
          className="backdrop open"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <TopBar
        onToggleSidebar={handleToggleSidebar}
        query={query}
        onQueryChange={setQuery}
        isSidebarCollapsed={collapsed}
      />

      <main className={collapsed ? "app-main collapsed" : "app-main"}>
        <div key={location.pathname} className="page-enter">
          <ErrorBoundary>
            <Outlet context={{ query }} />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

export function useSearchQuery(): string {
  const context = useOutletContext<{ query: string }>();
  return context?.query ?? "";
}
