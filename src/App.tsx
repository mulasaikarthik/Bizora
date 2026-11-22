import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import { AuthLandingPage } from "./pages/AuthLanding";
import { ClientDetailPage } from "./pages/ClientDetail";
import { ClientsPage } from "./pages/Clients";
import { DashboardPage } from "./pages/Dashboard";
import { ExpensesPage } from "./pages/Expenses";
import { ForecastPage } from "./pages/Forecast";
import { InvoiceDetailPage } from "./pages/InvoiceDetail";
import { InvoicesPage } from "./pages/Invoices";
import { NewInvoicePage } from "./pages/NewInvoice";
import { NotFoundPage } from "./pages/NotFound";
import { PaymentsPage } from "./pages/Payments";
import { SettingsPage } from "./pages/Settings";

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--c-bg, #F8F7FC)",
          color: "var(--c-primary, #5A388C)",
          fontFamily: "var(--font)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 44,
              height: 44,
              border: "3px solid #E6E0F0",
              borderTopColor: "#5A388C",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ fontWeight: 600, fontSize: 14 }}>Authenticating Bizora session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Layout />;
}

export default function App() {
  return (
    <Routes>
      {/* Dedicated Standalone Auth & Process Explanation Landing Page */}
      <Route path="/auth" element={<AuthLandingPage />} />
      <Route path="/login" element={<Navigate to="/auth?mode=login" replace />} />
      <Route path="/signup" element={<Navigate to="/auth?mode=signup" replace />} />

      {/* Main Protected Studio Shell */}
      <Route element={<ProtectedLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/new" element={<NewInvoicePage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
