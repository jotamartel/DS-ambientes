import type { ReactNode } from "react";
import { Link } from "@remix-run/react";

export function CustomerLayout({
  title,
  eyebrow,
  back,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  back?: { to: string; label: string };
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="cu-container">
      <header className="cu-header">
        {back ? (
          <Link to={back.to} className="cu-header-link">
            ← {back.label}
          </Link>
        ) : null}
        <div className="cu-header-row">
          <div>
            {eyebrow ? <p className="cu-eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
          </div>
          {actions ? <div className="cu-row">{actions}</div> : null}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="cu-banner">{message}</div>;
}

export function Empty({ message }: { message: string }) {
  return <div className="cu-empty">{message}</div>;
}
