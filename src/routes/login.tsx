import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { session, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<null | "google" | "email" | "reset">(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, session, navigate]);

  const signInWithGoogle = async () => {
    setErr(null);
    setBusy("google");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch {
      setErr(
        "Unable to sign in with Google. Make sure you're using the account associated with your team access.",
      );
      setBusy(null);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy("email");
    try {
      await signIn(email, password);
      navigate({ to: "/", replace: true });
    } catch {
      setErr("Invalid email or password.");
    } finally {
      setBusy(null);
    }
  };

  const sendReset = async () => {
    if (!email) {
      setErr("Enter your email above first, then click Forgot password.");
      return;
    }
    setErr(null);
    setBusy("reset");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/login",
      });
      if (error) throw error;
      toast.success("Check your email for a reset link");
    } catch {
      setErr("Unable to send reset email. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const JOST = "Jost, sans-serif";

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4"
      style={{ background: "#FAF8F4" }}
    >
      <div
        className="w-full"
        style={{
          maxWidth: 400,
          background: "#FFFFFF",
          border: "1px solid #E8E2D9",
          borderRadius: 12,
          padding: 48,
        }}
      >
        <div className="mb-8 text-center">
          <div
            style={{
              color: "#9A9188",
              fontFamily: JOST,
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Gilbertsville Farmhouse
          </div>
          <h1
            className="mt-3"
            style={{
              fontFamily: '"Cormorant Garamond", serif',
              color: "#1A1A1A",
              fontSize: 24,
              textAlign: "center",
            }}
          >
            Lodging Management
          </h1>
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-3 rounded-md transition disabled:opacity-50"
          style={{
            background: "#FFFFFF",
            border: "1px solid #E8E2D9",
            color: "#3A3A3A",
            fontFamily: JOST,
            fontSize: 14,
            height: 48,
          }}
        >
          <GoogleIcon />
          {busy === "google" ? "Redirecting…" : "Sign in with Google"}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div style={{ flex: 1, height: 1, background: "#E8E2D9" }} />
          <span style={{ color: "#9A9188", fontFamily: JOST, fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: "#E8E2D9" }} />
        </div>

        <form onSubmit={submitEmail}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-md px-3 focus:outline-none"
            style={{
              border: "1px solid #E8E2D9",
              background: "#FFFFFF",
              color: "#1A1A1A",
              fontFamily: JOST,
              fontSize: 14,
              height: 44,
            }}
          />
          <div className="relative mt-3">
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-md px-3 pr-10 focus:outline-none"
              style={{
                border: "1px solid #E8E2D9",
                background: "#FFFFFF",
                color: "#1A1A1A",
                fontFamily: JOST,
                fontSize: 14,
                height: 44,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute inset-y-0 right-2 flex items-center"
              style={{ color: "#9A9188" }}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={busy !== null}
            className="mt-5 w-full rounded-md text-white transition disabled:opacity-50"
            style={{
              background: "#3F5A3D",
              fontFamily: JOST,
              fontSize: 13,
              letterSpacing: "1px",
              textTransform: "uppercase",
              height: 48,
            }}
          >
            {busy === "email" ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={sendReset}
            disabled={busy !== null}
            style={{
              color: "#9A9188",
              fontFamily: JOST,
              fontSize: 12,
              background: "transparent",
            }}
          >
            {busy === "reset" ? "Sending…" : "Forgot password?"}
          </button>
        </div>

        {err && (
          <p
            className="mt-4 text-center"
            style={{ color: "#C0392B", fontFamily: JOST, fontSize: 13 }}
          >
            {err}
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.614z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}