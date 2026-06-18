import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, session, navigate]);

  const signInWithGoogle = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch {
      setErr(
        "Unable to sign in. Make sure you're using the Google account associated with your Gilbertsville team access.",
      );
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
            className="mt-3"
            style={{
              fontFamily: '"Cormorant Garamond", serif',
              color: "#1A1A1A",
              fontSize: "24px",
            }}
          >
            Lodging Management
          </h1>
        </div>

        <div
          className="rounded-lg p-6"
          style={{ background: "#FFFFFF", border: "1px solid #E8E2D9" }}
        >
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-md px-4 py-2.5 transition disabled:opacity-50"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E8E2D9",
              color: "#3A3A3A",
              fontFamily: "Jost, sans-serif",
              fontSize: "14px",
            }}
          >
            <GoogleIcon />
            {busy ? "Redirecting…" : "Sign in with Google"}
          </button>

          {err && (
            <p
              className="mt-3"
              style={{
                color: "#C0392B",
                fontFamily: "Jost, sans-serif",
                fontSize: "13px",
              }}
            >
              {err}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.614z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}