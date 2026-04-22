import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";

export function AdminShell({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const path = location.pathname;
  const { session, isAdmin, loading, signIn, signOut } = useAuth();

  const nav = [
    { to: "/", label: "Lodging Blocks" },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        One moment…
      </div>
    );
  }

  if (!session || !isAdmin) {
    return <SignInScreen onSignIn={signIn} signedInButNotAdmin={!!session && !isAdmin} onSignOut={signOut} />;
  }

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
            <button
              onClick={() => {
                signOut();
                toast.success("Signed out");
              }}
              className="text-xs uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
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

function SignInScreen({
  onSignIn,
  signedInButNotAdmin,
  onSignOut,
}: {
  onSignIn: (email: string, password: string) => Promise<void>;
  signedInButNotAdmin: boolean;
  onSignOut: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSignIn(email, password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <span className="font-serif text-xl leading-none">G</span>
          </span>
          <h1 className="mt-4 font-serif text-3xl text-foreground">Lodging Manager</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Gilbertsville Farmhouse
          </p>
        </div>

        {signedInButNotAdmin ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-foreground">This account isn't an admin.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask Brandon to grant admin access, or sign in with a different account.
            </p>
            <button
              onClick={() => onSignOut()}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
            >
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                placeholder="you@gilbertsvillefarmhouse.com"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full rounded-full bg-primary px-4 py-2.5 text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
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