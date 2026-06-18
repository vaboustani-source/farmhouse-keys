import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { session, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signIn(email, password);
      navigate({ to: "/", replace: true });
    } catch {
      setErr("Invalid email or password. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4"
      style={{ background: "#FAF8F4" }}
    >
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div
            className="text-[11px] uppercase tracking-[0.2em]"
            style={{ color: "#9A9188", fontFamily: "Jost, sans-serif" }}
          >
            Gilbertsville Farmhouse
          </div>
          <h1
            className="mt-3 text-[24px]"
            style={{ fontFamily: '"Cormorant Garamond", serif', color: "#1A1A1A" }}
          >
            Lodging Management
          </h1>
        </div>

        <form
          onSubmit={submit}
          className="rounded-lg border p-6"
          style={{ background: "#FFFFFF", borderColor: "#E8E2D8" }}
        >
          <label className="block">
            <span
              className="text-[11px] uppercase tracking-[0.16em]"
              style={{ color: "#9A9188", fontFamily: "Jost, sans-serif" }}
            >
              Email
            </span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded border px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: "#D9D2C7", background: "#FFFFFF", color: "#1A1A1A" }}
            />
          </label>
          <label className="mt-4 block">
            <span
              className="text-[11px] uppercase tracking-[0.16em]"
              style={{ color: "#9A9188", fontFamily: "Jost, sans-serif" }}
            >
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded border px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: "#D9D2C7", background: "#FFFFFF", color: "#1A1A1A" }}
            />
          </label>

          {err && (
            <p
              className="mt-3 text-[13px]"
              style={{ color: "#C0392B", fontFamily: "Jost, sans-serif" }}
            >
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-full px-4 py-2.5 text-xs uppercase tracking-wider text-white transition disabled:opacity-50"
            style={{ background: "#3F5A3D", fontFamily: "Jost, sans-serif", letterSpacing: "0.18em" }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}