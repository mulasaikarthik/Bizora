import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { CometTabBar, PasswordStrengthMeter } from "../components/InteractiveMicroWidgets";

export function AuthLandingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { signIn, signUp, resetPassword, user } = useAuth();

  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [authMode, setAuthMode] = useState<string>(initialMode);
  const [loadingAction, setLoadingAction] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  // Sign In Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Sign Up Form State
  const [signupName, setSignupName] = useState("");
  const [signupBusiness, setSignupBusiness] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      toast.show("Please enter your email and password.", "error");
      return;
    }

    setLoadingAction(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoadingAction(false);

    if (error) {
      toast.show(error, "error");
      return;
    }

    toast.show("Welcome back to Bizora! Entering your finance dashboard...", "success");
    navigate("/dashboard");
  };

  const handleSignupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword) {
      if (!signupPassword) {
        toast.show("Please create a password for your account.", "error");
        return;
      }
      toast.show("Please provide your name and email to proceed.", "error");
      return;
    }

    if (signupPassword.length < 6) {
      toast.show("Password must be at least 6 characters.", "error");
      return;
    }

    setLoadingAction(true);
    const { error, message } = await signUp(signupEmail, signupPassword, signupName, signupBusiness);
    setLoadingAction(false);

    if (error) {
      toast.show(error, "error");
      return;
    }

    if (message) {
      toast.show(message, "info");
    } else {
      toast.show(`Account created for ${signupName}! Launching dashboard...`, "success");
      navigate("/dashboard");
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    const target = forgotEmail.trim() || loginEmail.trim();
    if (!target) {
      toast.show("Please enter your email address.", "error");
      return;
    }
    setLoadingAction(true);
    const { error, message } = await resetPassword(target);
    setLoadingAction(false);
    if (error) {
      toast.show(error, "error");
    } else {
      toast.show(message || "Password reset instructions sent to your email inbox.", "success");
      setShowForgotModal(false);
    }
  };

  // Color tokens requested:
  // Primary Purple: #5A388C
  // Interactive Lavender: #8B7CC7
  // Misty Lilac: #C9C3E3
  const primaryPurple = "#5A388C";
  const mistyLilac = "#C9C3E3";

  return (
    <div
      className="auth-landing-page"
      style={{
        minHeight: "100vh",
        background: "#F8F7FC",
        color: "#241C38",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font)",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 36px",
          background: "#FFFFFF",
          borderBottom: "1.5px solid #E6E0F0",
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "0 2px 8px rgba(36, 28, 56, 0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Logo variant="full" size={36} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#5B5270" }}>
                Signed in as <strong>{user.email}</strong>
              </span>
              <Link
                to="/dashboard"
                className="btn btn-primary"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  background: primaryPurple,
                  borderColor: primaryPurple,
                }}
              >
                Go to Dashboard →
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Hero & Auth Container */}
      <main
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          width: "100%",
          padding: "48px 32px 72px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 48,
          alignItems: "center",
        }}
      >
        {/* Left Column: Integrated Small Business & Freelancer Problem & Complete Solution Text */}
        <div>
          <span
            style={{
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: "var(--radius-full)",
              background: "#FDEBFA",
              color: primaryPurple,
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: "0.04em",
              marginBottom: 16,
              border: `1.5px solid ${mistyLilac}`,
            }}
          >
            FREELANCER & SMALL BUSINESS FINANCE
          </span>

          <h1
            style={{
              fontSize: "clamp(2rem, 3.8vw, 3rem)",
              fontWeight: 800,
              lineHeight: 1.18,
              color: "#241C38",
              letterSpacing: "-0.03em",
              margin: "0 0 16px",
            }}
          >
            Eliminate delayed payments. <br />
            <span style={{ color: primaryPurple }}>Never wonder how much money</span> you'll actually have.
          </h1>

          <p
            style={{
              fontSize: 15.5,
              lineHeight: 1.7,
              color: "#5B5270",
              marginBottom: 18,
              maxWidth: 540,
            }}
          >
            Freelancers and small business owners often deal with delayed payments, unpaid invoices, upcoming expenses and bills, and the constant uncertainty of how much money they will actually have available.
          </p>

          <p
            style={{
              fontSize: 15.5,
              lineHeight: 1.75,
              color: "#5B5270",
              marginBottom: 20,
              maxWidth: 540,
            }}
          >
            <strong>BIZORA</strong> is a comprehensive business finance dashboard built to bring all of that into one unified, clear place. It helps you effortlessly keep track of your complete <strong>client records and payment history</strong>, manage <strong>invoices, in-time due dates, and real-time payment statuses</strong>, and log <strong>partial payments and remaining balances</strong> with zero calculation errors.
          </p>

          <p
            style={{
              fontSize: 15.5,
              lineHeight: 1.75,
              color: "#5B5270",
              marginBottom: 0,
              maxWidth: 540,
            }}
          >
            Stay ahead of <strong>upcoming expenses and recurring bills</strong>, receive automated alerts for <strong>overdue payments with prompt follow-up messages</strong>, generate <strong>multi-month cash flow forecasts</strong>, and run <strong>scenarios showing exactly how delayed client payments can affect future finances</strong> so you can plan operations with certainty.
          </p>
        </div>

        {/* Right Column: Clean Interactive Login & Sign Up Card */}
        <div
          className="card"
          style={{
            background: "#FFFFFF",
            border: `1.5px solid ${mistyLilac}`,
            borderRadius: "var(--radius-lg)",
            padding: 34,
            boxShadow: "0 18px 40px -10px rgba(90, 56, 140, 0.12)",
          }}
        >
          {/* Tab Bar using Comet Streak */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <CometTabBar
              tabs={[
                { id: "login", label: "Sign In" },
                { id: "signup", label: "Create Account" },
              ]}
              activeId={authMode}
              onChange={setAuthMode}
            />
          </div>

          {authMode === "login" ? (
            /* ================= SIGN IN ================= */
            <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ textAlign: "center", marginBottom: 6 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#241C38" }}>
                  Sign in to Bizora
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#5B5270" }}>
                  Access your client payment ledger and live cash flow forecast.
                </p>
              </div>

              <div className="form-field">
                <label htmlFor="login-email" style={{ color: "#241C38", fontWeight: 600 }}>
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="your.name@business.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  style={{
                    border: `1.5px solid ${mistyLilac}`,
                    borderRadius: "var(--radius-sm)",
                    background: "#F8F7FC",
                  }}
                />
              </div>

              <div className="form-field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="login-password" style={{ color: "#241C38", fontWeight: 600 }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(loginEmail);
                      setShowForgotModal(true);
                    }}
                    style={{
                      background: "none",
                      border: 0,
                      fontSize: 12,
                      color: primaryPurple,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="login-password"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{
                    border: `1.5px solid ${mistyLilac}`,
                    borderRadius: "var(--radius-sm)",
                    background: "#F8F7FC",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#5B5270" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: primaryPurple, width: 16, height: 16 }}
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loadingAction}
                className="btn btn-primary"
                style={{
                  padding: "12px 20px",
                  fontSize: 15,
                  fontWeight: 700,
                  marginTop: 6,
                  background: primaryPurple,
                  borderColor: primaryPurple,
                  boxShadow: "0 4px 14px rgba(90, 56, 140, 0.28)",
                  opacity: loadingAction ? 0.7 : 1,
                  cursor: loadingAction ? "not-allowed" : "pointer",
                }}
              >
                {loadingAction ? "Signing in..." : "Sign In to Dashboard →"}
              </button>
            </form>
          ) : (
            /* ================= SIGN UP ================= */
            <form onSubmit={handleSignupSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ textAlign: "center", marginBottom: 6 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#241C38" }}>
                  Create Your Business Account
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#5B5270" }}>
                  Start tracking client due dates and forecasting cash reserves.
                </p>
              </div>

              <div className="form-field">
                <label htmlFor="su-name" style={{ color: "#241C38", fontWeight: 600 }}>
                  Your Full Name *
                </label>
                <input
                  id="su-name"
                  type="text"
                  required
                  placeholder="Alex Morgan"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  style={{
                    border: `1.5px solid ${mistyLilac}`,
                    borderRadius: "var(--radius-sm)",
                    background: "#F8F7FC",
                  }}
                />
              </div>

              <div className="form-field">
                <label htmlFor="su-business" style={{ color: "#241C38", fontWeight: 600 }}>
                  Business or Brand Name
                </label>
                <input
                  id="su-business"
                  type="text"
                  placeholder="Morgan Creative Studio"
                  value={signupBusiness}
                  onChange={(e) => setSignupBusiness(e.target.value)}
                  style={{
                    border: `1.5px solid ${mistyLilac}`,
                    borderRadius: "var(--radius-sm)",
                    background: "#F8F7FC",
                  }}
                />
              </div>

              <div className="form-field">
                <label htmlFor="su-email" style={{ color: "#241C38", fontWeight: 600 }}>
                  Email *
                </label>
                <input
                  id="su-email"
                  type="email"
                  required
                  placeholder="alex@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  style={{
                    border: `1.5px solid ${mistyLilac}`,
                    borderRadius: "var(--radius-sm)",
                    background: "#F8F7FC",
                  }}
                />
              </div>

              {/* Password with 4-step dynamic strength meter */}
              <PasswordStrengthMeter
                label="Password *"
                onPasswordChange={setSignupPassword}
              />

              <button
                type="submit"
                disabled={loadingAction}
                className="btn btn-primary"
                style={{
                  padding: "12px 20px",
                  fontSize: 15,
                  fontWeight: 700,
                  marginTop: 8,
                  background: primaryPurple,
                  borderColor: primaryPurple,
                  boxShadow: "0 4px 14px rgba(90, 56, 140, 0.28)",
                  opacity: loadingAction ? 0.7 : 1,
                  cursor: loadingAction ? "not-allowed" : "pointer",
                }}
              >
                {loadingAction ? "Creating account..." : "Create Account & Launch Dashboard →"}
              </button>
            </form>
          )}

          {/* Forgot Password Modal */}
          {showForgotModal && (
            <div
              style={{
                marginTop: 20,
                padding: 18,
                background: "#FDEBFA",
                border: `1.5px solid ${mistyLilac}`,
                borderRadius: "var(--radius-md)",
              }}
            >
              <h4 style={{ margin: "0 0 8px", fontSize: 14, color: primaryPurple, fontWeight: 700 }}>
                Reset Your Password
              </h4>
              <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#5B5270" }}>
                Enter your registered email and we will send you a secure password reset link.
              </p>
              <form onSubmit={handleForgotPassword} style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  required
                  placeholder="name@business.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${mistyLilac}`,
                    background: "#FFFFFF",
                    fontSize: 13,
                  }}
                />
                <button
                  type="submit"
                  disabled={loadingAction}
                  style={{
                    background: primaryPurple,
                    color: "#FFFFFF",
                    border: 0,
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 14px",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Send Link
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  style={{
                    background: "transparent",
                    color: "#5B5270",
                    border: "1px solid #E6E0F0",
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 12px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
