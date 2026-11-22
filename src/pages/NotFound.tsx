import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="card" role="alert">
      <h1 className="card-title">Page not found</h1>
      <p>The page you are looking for does not exist or has moved.</p>
      <Link to="/dashboard">Back to dashboard</Link>
    </section>
  );
}
