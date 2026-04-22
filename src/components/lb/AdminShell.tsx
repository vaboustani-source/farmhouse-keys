import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AdminShell({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const path = location.pathname;

  const nav = [
    { to: "/", label: "Lodging Blocks" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <span className="font-serif text-lg leading-none">G</span>
            </span>
            <div className="leading-tight">
              <div className="font-serif text-lg text-foreground">Gilbertsville Farmhouse</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Lodging Manager
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`transition-colors ${
                  path === n.to ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-muted-foreground">
        A private estate. Tended by hand.
      </footer>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    active: "bg-accent/20 text-accent-foreground border-accent/40",
    closed: "bg-primary/10 text-primary border-primary/30",
    full: "bg-primary text-primary-foreground border-primary",
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${
        styles[status] ?? styles.draft
      }`}
    >
      {label}
    </span>
  );
}

export function FillBar({
  filled,
  total,
  className = "",
}: {
  filled: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? Math.min(100, (filled / total) * 100) : 0;
  const full = filled >= total && total > 0;
  const halfway = pct >= 50;
  const color = full
    ? "bg-primary"
    : halfway
      ? "bg-primary/70"
      : "bg-accent";
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-border ${className}`}>
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function formatMoney(n: number | null | undefined) {
  const value = Number(n ?? 0);
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}