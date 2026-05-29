import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/update-payment/$bookingToken/")({
  component: UpdatePaymentPage,
});

const STRIPE_PK = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ?? "";

type Summary = {
  weddingName: string;
  sectionName: string;
  checkInDate: string | null;
  checkOutDate: string | null;
  balance: number;
  chargeDate: string | null;
  paymentStatus: string;
  guestName: string;
};

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans text-[#1A1A1A]">
      <div className="mx-auto w-full max-w-[560px] px-4 py-16">
        <div className="text-center">
          <div className="font-serif text-2xl tracking-wide text-[#2C3E2D]">
            Gilbertsville Farmhouse
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[#6B6B6B]">
            A private estate
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function MessagePanel({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="mt-12 rounded-md border border-[#E8E2D9] bg-white p-8 text-center">
        <h1 className="font-serif text-2xl text-[#1A1A1A]">{title}</h1>
        <p className="mt-3 text-sm text-[#6B6B6B]">{body}</p>
      </div>
    </Shell>
  );
}

function UpdatePaymentPage() {
  const { bookingToken } = Route.useParams();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "invalid" }
    | { status: "expired" }
    | { status: "paid"; booking: Summary }
    | { status: "valid"; clientSecret: string; booking: Summary }
    | { status: "error"; message: string }
  >({ status: "loading" });

  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (STRIPE_PK ? loadStripe(STRIPE_PK) : null),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("create-setup-intent", {
          body: { bookingToken },
        });
        if (cancelled) return;
        if (error) {
          setState({ status: "error", message: error.message });
          return;
        }
        if (data?.status === "valid") {
          setState({ status: "valid", clientSecret: data.clientSecret, booking: data.booking });
        } else if (data?.status === "paid") {
          setState({ status: "paid", booking: data.booking });
        } else if (data?.status === "expired") {
          setState({ status: "expired" });
        } else {
          setState({ status: "invalid" });
        }
      } catch (e) {
        if (!cancelled) setState({ status: "error", message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingToken]);

  if (state.status === "loading") {
    return (
      <Shell>
        <p className="mt-16 text-center text-sm text-[#6B6B6B]">Loading…</p>
      </Shell>
    );
  }
  if (state.status === "invalid") {
    return (
      <MessagePanel
        title="This link doesn't seem right."
        body="Reach out to your planning team."
      />
    );
  }
  if (state.status === "expired") {
    return (
      <MessagePanel
        title="This link has expired."
        body="Reach out to your planning team if you need to update your payment method."
      />
    );
  }
  if (state.status === "paid") {
    return (
      <MessagePanel
        title="Your reservation is paid in full."
        body="No further action needed."
      />
    );
  }
  if (state.status === "error") {
    return <MessagePanel title="Something went wrong." body={state.message} />;
  }

  if (!stripePromise) {
    return (
      <MessagePanel
        title="Card update temporarily unavailable."
        body="Stripe is not configured. Reach out to your planning team."
      />
    );
  }

  const { booking, clientSecret } = state;
  const isFailed = booking.paymentStatus === "payment_failed";

  return (
    <Shell>
      <div className="mt-12 text-center">
        <h1 className="font-serif text-3xl font-medium text-[#1A1A1A] md:text-4xl">
          Update your payment method.
        </h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          {booking.weddingName} · {booking.sectionName}
        </p>
      </div>

      {isFailed && (
        <div
          className="mt-8 rounded-sm border-l-[3px] px-4 py-3 text-sm"
          style={{ background: "#FDF3F0", borderLeftColor: "#C0392B", color: "#3a1a14" }}
        >
          Your scheduled payment of <strong>{fmtMoney(booking.balance)}</strong> was
          declined. Please update your payment method to keep your reservation.
        </div>
      )}

      <div className="mt-6 rounded-md border border-[#E8E2D9] bg-white p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#9A9188]">Reservation</div>
        <div className="mt-1 font-serif text-xl text-[#1A1A1A]">{booking.sectionName}</div>
        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-[#6B6B6B]">Check-in</dt>
          <dd className="text-right tabular-nums">{fmtDate(booking.checkInDate)}</dd>
          <dt className="text-[#6B6B6B]">Check-out</dt>
          <dd className="text-right tabular-nums">{fmtDate(booking.checkOutDate)}</dd>
          <dt className="text-[#6B6B6B]">Balance due</dt>
          <dd className="text-right tabular-nums">{fmtMoney(booking.balance)}</dd>
          <dt className="text-[#6B6B6B]">Charge date</dt>
          <dd className="text-right tabular-nums">{fmtDate(booking.chargeDate)}</dd>
        </dl>
      </div>

      <div className="mt-8 rounded-md border border-[#E8E2D9] bg-white p-6">
        <div className="mb-3 text-sm font-medium text-[#1A1A1A]">New card details</div>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: { colorPrimary: "#2C3E2D", fontFamily: "Jost, system-ui, sans-serif" },
            },
          }}
        >
          <SetupForm bookingToken={bookingToken} />
        </Elements>
      </div>
    </Shell>
  );
}

function SetupForm({ bookingToken }: { bookingToken: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setSubmitting(true);
    const returnUrl = `${window.location.origin}/update-payment/${bookingToken}/confirmed`;
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });
    if (error) {
      setError(error.message ?? "Could not save card.");
      setSubmitting(false);
      return;
    }
    navigate({
      to: "/update-payment/$bookingToken/confirmed",
      params: { bookingToken },
    });
  };

  return (
    <form onSubmit={onSubmit}>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="mt-3 text-sm text-[#C0392B]">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="mt-5 w-full rounded-md bg-[#2C3E2D] px-4 py-3 text-sm font-medium text-white hover:bg-[#243223] disabled:opacity-60"
      >
        {submitting ? "Saving your card…" : "Save payment method"}
      </button>
    </form>
  );
}