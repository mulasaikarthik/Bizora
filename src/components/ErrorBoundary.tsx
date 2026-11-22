import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Bizora ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "400px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 16px",
            fontFamily: "var(--font)",
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 540,
              width: "100%",
              padding: "32px 28px",
              textAlign: "center",
              borderRadius: "var(--radius-lg, 16px)",
              background: "var(--c-surface, #FFFFFF)",
              border: "1.5px solid var(--c-border, #E6E0F0)",
              boxShadow: "var(--shadow-md, 0 8px 24px rgba(90, 56, 140, 0.08))",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--c-surface-soft, #FDEBFA)",
                color: "var(--c-accent, #5A388C)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                marginBottom: 16,
              }}
            >
              📊
            </div>

            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 20,
                fontWeight: 800,
                color: "var(--c-text, #241C38)",
              }}
            >
              Something went wrong loading this view
            </h2>

            <p
              style={{
                margin: "0 0 20px",
                fontSize: 13.5,
                color: "var(--c-text-2, #5B5270)",
                lineHeight: 1.5,
              }}
            >
              {this.state.error?.message ||
                "A temporary issue occurred while rendering this financial view. You can reload this view or navigate back to your dashboard."}
            </p>

            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={this.handleReset}
                style={{
                  background: "var(--c-accent, #5A388C)",
                  borderColor: "var(--c-accent, #5A388C)",
                  fontWeight: 700,
                  padding: "10px 20px",
                }}
              >
                ↻ Reload View
              </button>

              <Link
                to="/dashboard"
                className="btn btn-secondary"
                onClick={this.handleReset}
                style={{
                  fontWeight: 600,
                  padding: "10px 20px",
                }}
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
