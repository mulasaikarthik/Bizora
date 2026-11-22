import type { ReactNode } from "react";

export interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, action, children, className }: CardProps) {
  return (
    <section className={"card card-hover" + (className ? " " + className : "")}>
      {(title !== undefined || action !== undefined) && (
        <header className="card-header">
          {title !== undefined && <h2 className="card-title">{title}</h2>}
          {action !== undefined && <div className="card-action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
