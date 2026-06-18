import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  lookupBooking,
  lookupSecondaryGuest,
  getSectionAddons,
  fetchSessionConfirmation,
  getReservationExtras,
} from "@/lib/booking.functions";
import { createCheckoutSession, checkSessionStatus } from "@/lib/checkout";
import { ReviewErrorBoundary } from "@/components/ReviewErrorBoundary";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/book/$eventSlug/$sectionSlug")({
  component: BookingFlow,
});

type Booking = NonNullable<Awaited<ReturnType<typeof lookupBooking>>["booking"]>;
type Addon = Awaited<ReturnType<typeof getSectionAddons>>["addons"][number];
type SecondaryBooking = NonNullable<Awaited<ReturnType<typeof lookupSecondaryGuest>>["booking"]>;

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
const fmtDateFull = (d: string | null | undefined) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
const addDays = (iso: string, days: number) => {
  const dt = new Date(iso + "T00:00:00");
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
};

function Wordmark() {
  return (
    <div className="text-center">
      <div className="font-serif text-2xl tracking-wide text-[#2C3E2D]">Gilbertsville Farmhouse</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[#6B6B6B]">A private estate</div>
    </div>
  );
}

function ProgressDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mx-auto flex items-center justify-center gap-2">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            i === step ? "bg-[#2C3E2D]" : "bg-[#E8E2D9]"
          }`}
        />
      ))}
    </div>
  );
}

function BookingFlow() {
  const { eventSlug, sectionSlug } = Route.useParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [cancelledBanner, setCancelledBanner] = useState<string | null>(null);
  const [checkingReturn, setCheckingReturn] = useState(false);
  // Hydration-safe post-payment detection. Server and initial client render
  // are identical (mounted=false, showSuccess=false). After hydration we read
  // the URL and flip to the confirmation view entirely client-side.
  const [mounted, setMounted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") setShowSuccess(true);
  }, []);

  // Restore session
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem(`gfh_booking_${eventSlug}_${sectionSlug}`);
    if (saved) {
      try {
        const b = JSON.parse(saved) as Booking;
        setBooking(b);
        if (b.payment_status === "pending" || b.payment_status === "payment_failed") setStep(2);
      } catch {}
    }
  }, [eventSlug, sectionSlug]);

  // Handle returning from Stripe (cancel/back-button) or fresh load cleanup
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cancelled = params.get("cancelled");
    const sessionId = params.get("session_id");
    const stripeSidKey = `gfh_stripe_session_${eventSlug}_${sectionSlug}`;

    if (cancelled === "true" && sessionId) {
      setCheckingReturn(true);
      checkSessionStatus(sessionId)
        .then(({ status }) => {
          if (status === "complete") {
            // Guest paid then hit back — show confirmation view in-place
            window.location.replace(
              `/book/${eventSlug}/${sectionSlug}?success=true&session_id=${sessionId}`,
            );
            return;
          }
          // 'expired' | 'open' | null → soft banner, allow fresh checkout
          setCancelledBanner(
            "Your previous session expired — your room is still available.",
          );
          sessionStorage.removeItem(stripeSidKey);
          // Strip query params so a refresh doesn't re-trigger
          const clean = `/book/${eventSlug}/${sectionSlug}`;
          window.history.replaceState({}, "", clean);
        })
        .catch(() => {
          setCancelledBanner(
            "Your previous session expired — your room is still available.",
          );
          sessionStorage.removeItem(stripeSidKey);
          window.history.replaceState({}, "", `/book/${eventSlug}/${sectionSlug}`);
        })
        .finally(() => setCheckingReturn(false));
    } else {
      // Fresh load (no cancelled param) — clear any stale Stripe session id
      sessionStorage.removeItem(stripeSidKey);
    }
  }, [eventSlug, sectionSlug]);

  // Post-hydration: render confirmation view client-side only.
  if (mounted && showSuccess) {
    return <ConfirmationView eventSlug={eventSlug} sectionSlug={sectionSlug} />;
  }

  return (
    <div className="min-h-dvh bg-[#FAF8F4] font-sans text-[#1A1A1A]">
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <Wordmark />
        {step === 2 && booking && (
          <div className="mt-10">
            <ProgressDots step={2} />
          </div>
        )}
        {checkingReturn && (
          <div className="mt-6 rounded-md border border-[#E8E2D9] bg-white p-4 text-center text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">
            Checking your previous session…
          </div>
        )}
        {cancelledBanner && step === 2 && (
          <div className="mt-6 rounded-md border border-[#C9A84C]/40 bg-[#FBF6E7] p-4 text-sm text-[#7a6420]">
            {cancelledBanner}
            <button
              onClick={() => setCancelledBanner(null)}
              className="ml-3 inline-flex min-h-[44px] items-center px-3 py-2 text-xs uppercase tracking-[0.16em] text-[#7a6420]/70 hover:text-[#7a6420]"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="mt-8">
          {step === 1 && (
            <EmailGate
              eventSlug={eventSlug}
              sectionSlug={sectionSlug}
              externalError={reviewError}
              onMatched={(b) => {
                try {
                  setReviewError(null);
                  setBooking(b);
                  sessionStorage.setItem(`gfh_booking_${eventSlug}_${sectionSlug}`, JSON.stringify(b));
                  if (b.payment_status === "pending" || b.payment_status === "payment_failed") setStep(2);
                } catch (err) {
                  console.error("Failed to enter review step", err, { booking: b });
                  setReviewError(
                    "Something went wrong loading your reservation. Please try again.",
                  );
                }
              }}
            />
          )}
          {step === 2 && booking && (
            <ReviewErrorBoundary
              onError={(err) => {
                console.error("ReviewStep crashed", err);
                setReviewError(
                  "Something went wrong loading your reservation. Please try again.",
                );
                setStep(1);
              }}
            >
              <ReviewStep
                booking={booking}
                eventSlug={eventSlug}
                sectionSlug={sectionSlug}
                onBack={() => setStep(1)}
              />
            </ReviewErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────── Step 1: Email Gate ───────────── */

function EmailGate({
  eventSlug,
  sectionSlug,
  onMatched,
  externalError,
}: {
  eventSlug: string;
  sectionSlug: string;
  onMatched: (b: Booking) => void;
  externalError?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusBooking, setStatusBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);

  const displayedError = error ?? externalError ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setBusyMessage(null);
    try {
      const { data: rows, error: rpcErr } = await supabase.rpc("lookup_guest_booking", {
        p_email: email.trim(),
        p_event_slug: eventSlug,
        p_section_slug: sectionSlug,
      });
      if (rpcErr) throw rpcErr;
      const booking = (rows?.[0] ?? null) as Booking | null;
      if (!booking) {
        setError("We don't have a reservation held for that email. Please reach out to your planning team.");
        return;
      }
      // ── Inspect stripe_session_id for in-flight / open / complete sessions ──
      if (booking.payment_status === "pending" || booking.payment_status === "payment_failed") {
        const { data: sidRow } = await supabase
          .from("lb_bookings")
          .select("stripe_session_id")
          .eq("id", booking.booking_id)
          .single();
        const sid = sidRow?.stripe_session_id ?? null;

        if (sid && sid.startsWith("PENDING_")) {
          const ts = Number(sid.split("_")[1] ?? 0);
          if (Date.now() - ts < 5 * 60 * 1000) {
            setBusyMessage(
              "Your reservation is currently being processed. Check your other device or wait a few minutes.",
            );
            return;
          }
        } else if (sid && sid.startsWith("cs_")) {
          try {
            const { status, url } = await checkSessionStatus(sid);
            if (status === "open" && url) {
              window.location.href = url;
              return;
            }
            if (status === "complete") {
              window.location.href = `/book/${eventSlug}/${sectionSlug}?success=true&session_id=${sid}`;
              return;
            }
            // expired → proceed normally; lock will be replaced when they click Reserve
          } catch {
            // fall through
          }
        }
      }
      try {
        if (booking.payment_status === "pending" || booking.payment_status === "payment_failed") {
          onMatched(booking);
        } else {
          setStatusBooking(booking);
        }
      } catch (transitionErr) {
        console.error("Booking step transition failed", transitionErr, { booking });
        setError("Something went wrong loading your reservation. Please try again.");
      }
    } catch (lookupErr) {
      console.error("lookupBooking failed", lookupErr);
      setError("Something went wrong loading your reservation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (statusBooking) {
    return <BookingStatusCard booking={statusBooking} />;
  }

  return (
    <div className="text-center">
      <h1 className="font-serif text-3xl font-medium md:text-4xl lg:text-5xl">Welcome to your weekend.</h1>
      <p className="mt-3 text-sm text-[#6B6B6B]">Enter the email on your invitation.</p>
      {busyMessage && (
        <div className="mx-auto mt-6 max-w-sm rounded-md border border-[#C9A84C]/40 bg-[#FBF6E7] p-4 text-sm text-[#7a6420]">
          {busyMessage}
        </div>
      )}
      <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-3">
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded border border-[#E8E2D9] bg-white px-4 py-3 text-base text-[#1A1A1A] focus:border-[#2C3E2D] focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !email}
          className="w-full rounded bg-[#2C3E2D] px-4 py-3 min-h-[44px] text-sm uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#2C3E2D]/90 disabled:opacity-50"
        >
          {loading ? "Checking your invitation…" : "Continue"}
        </button>
        {displayedError && <p className="pt-2 text-sm text-[#6B6B6B]">{displayedError}</p>}
      </form>
    </div>
  );
}

function BookingStatusCard({ booking }: { booking: Booking }) {
  return (
    <ReservationCard
      reservation={bookingToReservation(booking)}
      showSuccessBanner={false}
    />
  );
}

/* ───────────── Step 2: Review + Add-ons + Secondary ───────────── */

function ReviewStep({
  booking,
  eventSlug,
  sectionSlug,
  onBack,
}: {
  booking: Booking;
  eventSlug: string;
  sectionSlug: string;
  onBack: () => void;
}) {
  const fetchAddons = useServerFn(getSectionAddons);

  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [secondaryAddons, setSecondaryAddons] = useState<Addon[]>([]);
  const [secondarySelectedIds, setSecondarySelectedIds] = useState<string[]>([]);

  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [secondary, setSecondary] = useState<SecondaryBooking | null>(null);
  const [secondaryLookupErr, setSecondaryLookupErr] = useState<string | null>(null);
  const [lookingUpSecondary, setLookingUpSecondary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cotRequested, setCotRequested] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [agreedToCancellation, setAgreedToCancellation] = useState(false);

  const cotFee = useMemo(() => {
    if (!cotRequested) return 0;
    const nights = booking.nights || 2;
    return nights <= 1
      ? Number(booking.cot_1night_rate ?? 100)
      : Number(booking.cot_2night_rate ?? 150);
  }, [cotRequested, booking]);

  useEffect(() => {
    fetchAddons({ data: { sectionId: booking.section_id } }).then(({ addons }) => {
      setAddons(addons);
      setSelectedIds(addons.filter((a) => a.is_required).map((a) => a.id));
    });
  }, [booking.section_id, fetchAddons]);

  // Pricing math
  const calc = useMemo(() => {
    const nights = booking.nights || 2;
    const nightly = Number(booking.guest_nightly_rate) || 0;
    const base = nightly * nights;
    const addonAmt = addons
      .filter((a) => selectedIds.includes(a.id))
      .reduce((sum, a) => sum + Number(a.addon_price) * (a.addon_type === "per_night" ? nights : 1), 0);
    const subtotal = base + addonAmt;
    const resortFee = (subtotal * Number(booking.resort_fee_percent || 0)) / 100;
    const taxBase = subtotal + resortFee;
    const tax = taxBase * 0.08; // estimate; Stripe Tax confirms exact
    const total = subtotal + resortFee + tax;
    return { nights, nightly, base, addonAmt, resortFee, tax, total };
  }, [booking, addons, selectedIds]);

  const secondaryCalc = useMemo(() => {
    if (!secondary) return null;
    const nights = secondary.nights || 2;
    const nightly = Number(secondary.guest_nightly_rate) || 0;
    const base = nightly * nights;
    const addonAmt = secondaryAddons
      .filter((a) => secondarySelectedIds.includes(a.id))
      .reduce((sum, a) => sum + Number(a.addon_price) * (a.addon_type === "per_night" ? nights : 1), 0);
    const subtotal = base + addonAmt;
    const resortFee = (subtotal * Number(secondary.resort_fee_percent || 0)) / 100;
    const tax = (subtotal + resortFee) * 0.08;
    return { nights, nightly, base, addonAmt, resortFee, tax, total: subtotal + resortFee + tax };
  }, [secondary, secondaryAddons, secondarySelectedIds]);

  const grandTotal = calc.total + (secondaryCalc?.total ?? 0);
  const grandTotalWithCot = grandTotal + cotFee;

  const lookupSecondHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecondaryLookupErr(null);
    setLookingUpSecondary(true);
    try {
      const { data: rows, error: rpcErr } = await supabase.rpc("lookup_secondary_guest", {
        p_email: secondaryEmail.trim(),
        p_event_slug: eventSlug,
      });
      if (rpcErr) {
        console.error("lookup_secondary_guest failed", rpcErr);
        setSecondaryLookupErr("Something went wrong. Please try again.");
        return;
      }
      const row = (rows?.[0] ?? null) as SecondaryBooking | null;
      if (row && row.booking_id === booking.booking_id) {
        setSecondaryLookupErr("That's you — enter a different guest's email.");
        return;
      }
      if (!row) {
        setSecondaryLookupErr("That email isn't on the guest list for this weekend.");
        return;
      }
      if (row.payment_status !== "pending") {
        setSecondaryLookupErr("This guest's room is already reserved.");
        return;
      }
      setSecondary(row);
      // Secondary add-ons skipped for now — only base lodging is covered.
    } finally {
      setLookingUpSecondary(false);
    }
  };

  const reserve = async () => {
    setSubmitting(true);
    setReserveError(null);
    try {
      const { url, alreadyPaid, redirectUrl, locked, lockedMessage } = await createCheckoutSession({
        bookingId: booking.booking_id,
        addonIds: selectedIds.filter((id) => !addons.find((a) => a.id === id)?.is_required),
        secondaryBookingId: secondary?.booking_id ?? null,
        secondaryAddonIds: secondarySelectedIds.filter(
          (id) => !secondaryAddons.find((a) => a.id === id)?.is_required,
        ),
        eventSlug,
        sectionSlug,
        cotRequested,
      });
      if (locked) {
        setReserveError(
          lockedMessage ||
            "Your reservation is already being processed on another device. Complete it there or wait 5 minutes to try again.",
        );
        return;
      }
      if (alreadyPaid && redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      if (url) {
        try {
          sessionStorage.setItem(
            `gfh_stripe_session_${eventSlug}_${sectionSlug}`,
            new URL(url).searchParams.get("session_id") ?? "",
          );
        } catch {}
        window.location.href = url;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isSplit =
    booking.payment_schedule === "split_50_50" ||
    booking.payment_schedule === "deposit_50_balance_50";
  const dueToday = isSplit ? grandTotalWithCot * 0.5 : grandTotalWithCot;
  const remainingDue = isSplit ? grandTotalWithCot * 0.5 : 0;

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-6 inline-flex min-h-[44px] items-center -ml-1 px-2 py-2 text-xs uppercase tracking-[0.16em] text-[#6B6B6B] hover:text-[#1A1A1A]"
      >
        ← Back
      </button>

      {/* Guest name header */}
      <div className="mb-6">
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 24,
            color: "#1A1A1A",
          }}
        >
          {booking.guest_name},
        </div>
        <div
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 14,
            color: "#C9A84C",
            fontStyle: "italic",
            marginTop: 4,
          }}
        >
          Your room is held for you.
        </div>
      </div>

      {/* Card 1: Room details */}
      <div className="rounded-md border border-[#E8E2D9] bg-white p-6">
        <div className="font-serif text-3xl">{booking.section_name}</div>
        <div className="mt-2 text-sm text-[#6B6B6B]">
          {fmtDate(booking.check_in_date)} → {fmtDate(booking.check_out_date)} · {calc.nights} night
          {calc.nights === 1 ? "" : "s"}
        </div>
        <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[#C9A84C]">Your room is held for you</div>
      </div>

      {/* Card 2: Add-ons */}
      {addons.length > 0 && (
        <div className="mt-4 rounded-md border border-[#E8E2D9] bg-white p-6">
          <h2 className="font-serif text-xl">Enhance your stay</h2>
          <div className="mt-4 space-y-2">
            {addons.map((a) => {
              const checked = selectedIds.includes(a.id);
              const disabled = a.is_required;
              return (
                <label
                  key={a.id}
                  className={`flex cursor-pointer items-start justify-between gap-4 rounded border p-4 transition-colors ${
                    checked ? "border-[#2C3E2D] bg-[#FAF8F4]" : "border-[#E8E2D9]"
                  } ${disabled ? "cursor-default opacity-90" : ""}`}
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {a.addon_name}
                      {a.is_required && (
                        <span className="ml-2 rounded-full bg-[#C9A84C]/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#7a6420]">
                          Included
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-[#6B6B6B]">
                      {fmtMoney(Number(a.addon_price))}
                      {a.addon_type === "per_night"
                        ? " per night"
                        : a.addon_type === "per_person"
                          ? " per person"
                          : " per stay"}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => {
                      if (disabled) return;
                      setSelectedIds((prev) =>
                        e.target.checked ? [...prev, a.id] : prev.filter((x) => x !== a.id),
                      );
                    }}
                    className="mt-1 h-5 w-5 accent-[#2C3E2D]"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Cot / 3rd guest */}
      <div className="mt-4 rounded-md border border-[#E8E2D9] bg-white p-6">
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-serif text-xl">Add a 3rd guest</div>
              <div className="mt-1 text-sm text-[#6B6B6B]">
                Cot setup in your room — additional charge applies.
              </div>
              <div className="mt-2 text-xs text-[#6B6B6B]">
                {(booking.nights || 2) <= 1
                  ? `Flat ${fmtMoney(Number(booking.cot_1night_rate ?? 100))} for 1 night`
                  : `Flat ${fmtMoney(Number(booking.cot_2night_rate ?? 150))} for ${booking.nights} nights`}
              </div>
            </div>
            <input
              type="checkbox"
              checked={cotRequested}
              onChange={(e) => setCotRequested(e.target.checked)}
              className="mt-1 h-5 w-5 accent-[#2C3E2D]"
            />
          </label>
      </div>

      {/* Card 3: Secondary guest */}
      {!secondary && (
        <div className="mt-4 rounded-md border border-[#E8E2D9] bg-white p-6">
          <h2 className="font-serif text-xl">Covering a room for someone else?</h2>
          <p className="mt-1 text-xs text-[#6B6B6B]">You may add one additional guest's room to this reservation.</p>
          <form onSubmit={lookupSecondHandler} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={secondaryEmail}
              onChange={(e) => setSecondaryEmail(e.target.value)}
              placeholder="guest@example.com"
              className="flex-1 rounded border border-[#E8E2D9] bg-white px-3 py-2 min-h-[44px] text-base focus:border-[#2C3E2D] focus:outline-none"
            />
            <button
              type="submit"
              disabled={lookingUpSecondary || !secondaryEmail}
              className="rounded border border-[#2C3E2D] px-4 py-2 min-h-[44px] text-xs uppercase tracking-[0.16em] text-[#2C3E2D] disabled:opacity-50"
            >
              {lookingUpSecondary ? "Checking…" : "Add"}
            </button>
          </form>
          {secondaryLookupErr && <p className="mt-2 text-xs text-[#6B6B6B]">{secondaryLookupErr}</p>}
        </div>
      )}

      {secondary && (
        <div className="mt-4 rounded-md border border-[#2C3E2D]/30 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#C9A84C]">Booking for</div>
              <div className="font-serif text-xl">{secondary.guest_name}</div>
              <div className="mt-1 text-xs text-[#6B6B6B]">{secondary.section_name}</div>
            </div>
            <button
              onClick={() => {
                setSecondary(null);
                setSecondaryAddons([]);
                setSecondarySelectedIds([]);
                setSecondaryEmail("");
              }}
              className="inline-flex min-h-[44px] items-center px-3 py-2 text-xs uppercase tracking-[0.16em] text-[#6B6B6B] hover:text-[#1A1A1A]"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Card 4: Price summary */}
      <div className="mt-4 rounded-md border border-[#E8E2D9] bg-white p-6">
        <h2 className="font-serif text-xl">Summary</h2>
        <div className="mt-4 space-y-2 text-sm">
          <Row
            label={`${booking.section_name} · ${calc.nights} × ${fmtMoney(calc.nightly)}`}
            value={fmtMoney(calc.base)}
          />
          {addons
            .filter((a) => selectedIds.includes(a.id))
            .map((a) => (
              <Row
                key={a.id}
                label={a.addon_name}
                value={fmtMoney(Number(a.addon_price) * (a.addon_type === "per_night" ? calc.nights : 1))}
              />
            ))}
          {secondaryCalc && secondary && (
            <>
              <Row
                label={`${secondary.section_name} · ${secondaryCalc.nights} × ${fmtMoney(secondaryCalc.nightly)}`}
                value={fmtMoney(secondaryCalc.base)}
              />
              {secondaryAddons
                .filter((a) => secondarySelectedIds.includes(a.id))
                .map((a) => (
                  <Row
                    key={`s-${a.id}`}
                    label={a.addon_name}
                    value={fmtMoney(
                      Number(a.addon_price) * (a.addon_type === "per_night" ? secondaryCalc.nights : 1),
                    )}
                  />
                ))}
            </>
          )}
          <Row
            label={`Resort Fee (${booking.resort_fee_percent}%)`}
            value={fmtMoney(calc.resortFee + (secondaryCalc?.resortFee ?? 0))}
          />
          <Row label="NY Sales Tax (est. 8%)" value={fmtMoney(calc.tax + (secondaryCalc?.tax ?? 0))} />
          {cotRequested && (
            <Row label="3rd guest / cot setup" value={fmtMoney(cotFee)} />
          )}
        </div>
        <div className="mt-4 border-t border-[#E8E2D9] pt-4">
          <div className="flex items-baseline justify-between">
            <div className="font-serif text-lg">Total</div>
            <div className="font-serif text-2xl text-[#2C3E2D]">{fmtMoney(grandTotalWithCot)}</div>
          </div>
          {isSplit ? (
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6B6B6B]">Due today (50%)</span>
                <span>{fmtMoney(dueToday)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B6B]">
                  Due 30 days before check-in (50%)
                </span>
                <span>{fmtMoney(remainingDue)}</span>
              </div>
              <p className="pt-2 text-xs text-[#6B6B6B]">
                We'll email you a friendly reminder when your final balance is due.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#6B6B6B]">Payment due in full today.</p>
          )}
        </div>
      </div>

      {/* Cancellation policy */}
      <div className="mt-6">
        <p
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#9A9188",
            margin: 0,
          }}
        >
          CANCELLATION POLICY
        </p>
        <p
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 13,
            color: "#6B6B6B",
            fontWeight: 300,
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          Cancellation is possible up to 45 days prior to the first check-in date of your stay. After that time, the reservation is fully non-refundable.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreedToCancellation}
            onChange={(e) => setAgreedToCancellation(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#2C3E2D]"
          />
          <span
            style={{
              fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
              fontSize: 13,
              color: "#6B6B6B",
              fontWeight: 300,
            }}
          >
            I understand and agree to the cancellation policy.
          </span>
        </label>
      </div>

      <button
        onClick={reserve}
        disabled={submitting || !agreedToCancellation}
        className={`mt-6 w-full rounded px-4 py-4 text-sm uppercase tracking-[0.16em] text-white transition-colors ${
          agreedToCancellation
            ? "bg-[#2C3E2D] hover:bg-[#2C3E2D]/90"
            : "bg-[#2C3E2D]/50"
        } disabled:opacity-50`}
      >
        {submitting ? "Confirming with Stripe…" : secondary ? "Reserve our rooms" : "Reserve my room"}
      </button>
      {reserveError && (
        <div className="mt-4 rounded-md border border-[#C9A84C]/40 bg-[#FBF6E7] p-4 text-sm text-[#7a6420]">
          {reserveError}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="min-w-0 flex-1 break-words text-[#6B6B6B]">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

/* ───────────── Post-Stripe Confirmation View ───────────── */

type ConfirmationBookings = Awaited<ReturnType<typeof fetchSessionConfirmation>>["bookings"];

function ConfirmationView({
  eventSlug,
  sectionSlug,
}: {
  eventSlug: string;
  sectionSlug: string;
}) {
  const [bookings, setBookings] = useState<ConfirmationBookings>([]);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    // Clear any saved booking session data
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("gfh_booking_") || k.startsWith("gfh_stripe_session_"))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const paymentType = params.get("type"); // "balance" for balance payments
    console.log("Polling for session:", sessionId, "type:", paymentType);
    if (!sessionId) {
      setLoading(false);
      setTimedOut(true);
      return;
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    let cancelled = false;

    const poll = async (sid: string) => {
      const { data, error } = await supabase
        .from("lb_bookings")
        .select(
          `id, guest_name, guest_email, payment_status, payment_schedule,
           total_amount, base_amount, addon_amount, resort_fee, tax_amount,
           deposit_paid_at, final_paid_at, addons_selected, cot_requested,
           cot_fee, section_id, event_id, is_primary, covered_by_booking_id`,
        )
        .eq("stripe_session_id", sid)
        .maybeSingle();
      if (error) console.error("Poll error:", error);
      return data;
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const data = await poll(sessionId);
        console.log("Poll result:", data);
        const isReady =
          !!data &&
          (paymentType === "balance"
            ? data.payment_status === "paid"
            : data.payment_status === "paid" ||
              data.payment_status === "deposit_paid" ||
              data.payment_status === "covered");
        if (isReady && data) {
          // Fetch section + event details for the reservation card
          const [{ data: section }, { data: event }] = await Promise.all([
            supabase
              .from("lb_room_sections")
              .select("section_name, guest_nightly_rate, resort_fee_percent, nights")
              .eq("id", data.section_id)
              .maybeSingle(),
            supabase
              .from("lb_events")
              .select("wedding_name, couple_names, check_in_date, check_out_date")
              .eq("id", data.event_id)
              .maybeSingle(),
          ]);
          const enriched = [
            {
              ...data,
              covered_at: null,
              payment_update_token: null,
              section: section ?? null,
              event: event ?? null,
              payer_name: null,
            },
          ] as unknown as ConfirmationBookings;
          if (cancelled) return;
          setBookings(enriched);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Polling failed", err);
      }
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        setLoading(false);
        setTimedOut(true);
        return;
      }
      setTimeout(tick, 3000);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  const primary = bookings.find((b) => b.is_primary || !b.covered_by_booking_id);
  console.log("Rendering confirmation for:", primary?.payment_status ?? "none");

  const softFallback = (
    <div className="mt-16 text-center">
      <h1 className="font-serif text-3xl font-medium md:text-4xl">
        Your payment was received.
      </h1>
      <p className="mt-3 text-sm text-[#6B6B6B]">
        Your confirmation is on its way — check your email shortly.
      </p>
    </div>
  );

  let primaryCard: ReactNode = null;
  if (!loading && primary && !renderError) {
    try {
      primaryCard = (
        <div className="mt-10">
          {timedOut && (
            <div className="mb-6 rounded-md border border-[#E8E2D9] bg-white p-5 text-center text-sm text-[#6B6B6B]">
              Your payment was received. Your confirmation is on its way — check your email shortly.
            </div>
          )}
          <ReservationCard
            reservation={sessionRowToReservation(primary)}
            showSuccessBanner
          />
        </div>
      );
    } catch (err) {
      console.error("ConfirmationView render failed", err);
      primaryCard = softFallback;
    }
  }

  return (
    <div className="min-h-dvh bg-[#FAF8F4] font-sans text-[#1A1A1A]">
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <Wordmark />
        {loading && <LoadingConfirmation />}
        {!loading && primary && (
          <ReviewErrorBoundary onError={(e) => { console.error("ReservationCard crashed", e); setRenderError(true); }}>
            {primaryCard ?? softFallback}
          </ReviewErrorBoundary>
        )}
        {!loading && !primary && softFallback}
        {!loading && renderError && softFallback}
      </div>
    </div>
  );
}

function LoadingConfirmation() {
  return (
    <div className="mt-20 text-center">
      <p
        className="text-sm text-[#6B6B6B]"
        style={{
          animation: "gfhBreath 2.4s ease-in-out infinite",
        }}
      >
        Confirming your reservation…
      </p>
      <style>{`@keyframes gfhBreath { 0%,100% { opacity:.55 } 50% { opacity:1 } }`}</style>
    </div>
  );
}

/* ───────────── Reservation Card (states 1-5) ───────────── */

type Reservation = {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  paymentStatus: string;
  paymentSchedule: string | null;
  depositPaidAt: string | null;
  finalPaidAt: string | null;
  totalAmount: number;
  baseAmount: number;
  addonAmount: number;
  resortFee: number;
  taxAmount: number;
  resortFeePercent: number;
  weddingName: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  sectionName: string | null;
  nights: number;
  isPrimary: boolean;
  paymentUpdateToken: string | null;
  payerName: string | null;
  refundAmount: number;
  refundedAt: string | null;
  refundReason: string | null;
};

function bookingToReservation(b: Booking): Reservation {
  const base = Number(b.base_amount) || 0;
  const addon = Number(b.addon_amount) || 0;
  const resort = Number(b.resort_fee) || 0;
  // Tax may not be stored — estimate at 8% on (base+addon+resort)
  const tax = Number(b.tax_amount) || (base + addon + resort) * 0.08;
  const storedTotal = Number(b.total_amount) || base + addon + resort;
  const total = storedTotal + (Number(b.tax_amount) ? 0 : tax);
  return {
    bookingId: b.booking_id,
    guestName: b.guest_name,
    guestEmail: b.guest_email,
    paymentStatus: b.payment_status,
    paymentSchedule: b.payment_schedule ?? null,
    depositPaidAt: b.deposit_paid_at ?? null,
    finalPaidAt: b.final_paid_at ?? null,
    totalAmount: total,
    baseAmount: base,
    addonAmount: addon,
    resortFee: resort,
    taxAmount: tax,
    resortFeePercent: Number(b.resort_fee_percent) || 0,
    weddingName: b.wedding_name ?? null,
    checkInDate: b.check_in_date ?? null,
    checkOutDate: b.check_out_date ?? null,
    sectionName: b.section_name ?? null,
    nights: Number(b.nights) || 2,
    isPrimary: !!b.is_primary,
    paymentUpdateToken: null,
    payerName: null,
    refundAmount: Number((b as { refund_amount?: number | null }).refund_amount) || 0,
    refundedAt: ((b as { refunded_at?: string | null }).refunded_at) ?? null,
    refundReason: ((b as { refund_reason?: string | null }).refund_reason) ?? null,
  };
}

function sessionRowToReservation(
  r: NonNullable<ConfirmationBookings[number]>,
): Reservation {
  const base = Number(r.base_amount) || 0;
  const addon = Number(r.addon_amount) || 0;
  const resort = Number(r.resort_fee) || 0;
  const tax = Number(r.tax_amount) || (base + addon + resort) * 0.08;
  const storedTotal = Number(r.total_amount) || base + addon + resort;
  const total = storedTotal + (Number(r.tax_amount) ? 0 : tax);
  return {
    bookingId: r.id,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    paymentStatus: r.payment_status as string,
    paymentSchedule: (r.payment_schedule as string | null) ?? null,
    depositPaidAt: (r.deposit_paid_at as string | null) ?? null,
    finalPaidAt: (r.final_paid_at as string | null) ?? null,
    totalAmount: total,
    baseAmount: base,
    addonAmount: addon,
    resortFee: resort,
    taxAmount: tax,
    resortFeePercent: Number(r.section?.resort_fee_percent) || 0,
    weddingName: r.event?.wedding_name ?? null,
    checkInDate: r.event?.check_in_date ?? null,
    checkOutDate: r.event?.check_out_date ?? null,
    sectionName: r.section?.section_name ?? null,
    nights: Number(r.section?.nights) || 2,
    isPrimary: !!r.is_primary,
    paymentUpdateToken: (r.payment_update_token as string | null) ?? null,
    payerName: (r as { payer_name?: string | null }).payer_name ?? null,
    refundAmount: Number((r as { refund_amount?: number | null }).refund_amount) || 0,
    refundedAt: ((r as { refunded_at?: string | null }).refunded_at) ?? null,
    refundReason: ((r as { refund_reason?: string | null }).refund_reason) ?? null,
  };
}

function daysBetween(fromIso: string, toIso: string) {
  const a = new Date(fromIso + "T00:00:00").getTime();
  const b = new Date(toIso + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

function ReservationCard({
  reservation,
  showSuccessBanner,
}: {
  reservation: Reservation;
  showSuccessBanner: boolean;
}) {
  const r = reservation;
  const [extras, setExtras] = useState<{
    token: string | null;
    payer: string | null;
  }>({ token: r.paymentUpdateToken, payer: r.payerName });
  const fetchExtras = useServerFn(getReservationExtras);

  useEffect(() => {
    if (
      (r.paymentStatus === "payment_failed" || r.paymentStatus === "covered") &&
      !extras.token &&
      !extras.payer
    ) {
      fetchExtras({ data: { bookingId: r.bookingId } })
        .then(({ paymentUpdateToken, payerName }) =>
          setExtras({ token: paymentUpdateToken, payer: payerName }),
        )
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.bookingId, r.paymentStatus]);

  // Covered state — minimal layout, no money
  if (r.paymentStatus === "covered") {
    return (
      <CoveredCard
        reservation={r}
        payerName={extras.payer ?? r.payerName}
      />
    );
  }

  // Refunded state — surface the refund prominently
  const isRefunded = r.paymentStatus === "refunded" || r.refundAmount > 0;
  if (isRefunded) {
    return <RefundedCard reservation={r} />;
  }

  const isPaid = r.paymentStatus === "paid";
  const isDeposit = r.paymentStatus === "deposit_paid";
  const isFailed = r.paymentStatus === "payment_failed";
  const isFullSchedule = r.paymentSchedule === "full";

  const deposit = r.totalAmount / 2;
  const balance = r.totalAmount / 2;
  const balanceDueIso =
    r.checkInDate ? addDays(r.checkInDate, -30) : null;
  const today = new Date().toISOString().slice(0, 10);
  const daysUntilBalance =
    balanceDueIso ? daysBetween(today, balanceDueIso) : 999;
  const isApproaching = isDeposit && daysUntilBalance <= 14 && daysUntilBalance >= 0;
  const isOverdue =
    (isDeposit && daysUntilBalance < 0) || isFailed;

  return (
    <div className="mx-auto max-w-[600px]">
      {showSuccessBanner && (
        <SuccessBanner guestName={r.guestName} email={r.guestEmail} isDeposit={isDeposit && !isFullSchedule} />
      )}

      <div className="rounded-[4px] border border-[#E8E2D9] bg-white p-5 sm:p-8 md:p-12">
        {isOverdue && (
          <div
            className="mb-6 rounded-sm border-l-[3px] border-[#C0392B] bg-[#FDF3F0] px-5 py-4"
            style={{
              fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
              fontSize: 14,
              color: "#C0392B",
            }}
          >
            Your scheduled payment didn't go through. Your room is still held — please pay below or update your card.
          </div>
        )}

        {/* SECTION A — Header */}
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 28,
            color: "#1A1A1A",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {isFailed
            ? `${r.guestName}, we need your attention.`
            : isPaid || isFullSchedule
              ? `${r.guestName}, you're confirmed.`
              : `${r.guestName}, your room is reserved.`}
        </h1>
        {r.weddingName && (
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: "italic",
              fontSize: 18,
              color: "#6B6B6B",
              marginTop: 6,
              marginBottom: 0,
            }}
          >
            {r.weddingName}
          </p>
        )}

        {/* SECTION B — Stay details */}
        <SectionLabel>YOUR STAY</SectionLabel>
        <div className="mt-2">
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 20,
              color: "#1A1A1A",
            }}
          >
            {r.sectionName}
          </div>
          <div
            style={{
              fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
              fontSize: 14,
              color: "#3A3A3A",
              marginTop: 4,
            }}
          >
            {fmtStayRange(r.checkInDate)} → {fmtStayRange(r.checkOutDate)}
          </div>
          <div
            style={{
              fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
              fontSize: 13,
              color: "#6B6B6B",
              marginTop: 2,
            }}
          >
            {r.nights} {r.nights === 1 ? "night" : "nights"}
          </div>
        </div>

        <Divider />

        {/* SECTION C — Invoice */}
        <SectionLabel>YOUR STAY</SectionLabel>
        <div className="mt-3 space-y-2">
          <InvoiceRow
            label={`Lodging · ${r.sectionName ?? ""} · ${r.nights} ${r.nights === 1 ? "night" : "nights"}`}
            value={fmtMoney(r.baseAmount + r.addonAmount)}
          />
          <InvoiceRow
            label={`Resort Fee (${r.resortFeePercent}%)`}
            value={fmtMoney(r.resortFee)}
          />
          <InvoiceRow label="NY Sales Tax (8%)" value={fmtMoney(r.taxAmount)} />
        </div>
        <div className="mt-3 border-t border-[#E8E2D9] pt-3">
          <div className="flex items-baseline justify-between">
            <span
              style={{
                fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 600,
                color: "#1A1A1A",
              }}
            >
              Total
            </span>
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 20,
                color: "#2C3E2D",
              }}
            >
              {fmtMoney(r.totalAmount)}
            </span>
          </div>
        </div>

        <Divider />

        {/* SECTION D — Payment timeline */}
        <SectionLabel>PAYMENT</SectionLabel>
        <div className="mt-3 space-y-3">
          <PaymentRow
            status="paid"
            label="Deposit"
            sub={r.depositPaidAt ? `Paid ${fmtDateFull(r.depositPaidAt.slice(0, 10))}` : "Paid"}
            amount={fmtMoney(deposit)}
            amountMuted
          />
          {isPaid ? (
            <>
              <PaymentRow
                status="paid"
                label="Balance"
                sub={r.finalPaidAt ? `Paid ${fmtDateFull(r.finalPaidAt.slice(0, 10))}` : "Paid"}
                amount={fmtMoney(balance)}
                amountMuted
              />
              <div className="flex items-baseline justify-between border-t border-[#E8E2D9] pt-3">
                <span
                  style={{
                    fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#2C3E2D",
                  }}
                >
                  Paid in full
                </span>
                <span
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 20,
                    color: "#2C3E2D",
                  }}
                >
                  {fmtMoney(r.totalAmount)}
                </span>
              </div>
            </>
          ) : isOverdue ? (
            <PaymentRow
              status="overdue"
              label="Remaining balance — past due"
              sub={balanceDueIso ? `Was due ${fmtDateFull(balanceDueIso)}` : "Past due"}
              amount={fmtMoney(balance)}
              amountTone="overdue"
            />
          ) : isApproaching ? (
            <PaymentRow
              status="approaching"
              label="Remaining balance"
              sub={
                balanceDueIso
                  ? `Due in ${daysUntilBalance} ${daysUntilBalance === 1 ? "day" : "days"} · ${fmtDateFull(balanceDueIso)}`
                  : "Due soon"
              }
              amount={fmtMoney(balance)}
              amountStrong
              subTone="gold"
            />
          ) : (
            <PaymentRow
              status="upcoming"
              label="Remaining balance"
              sub={balanceDueIso ? `Due ${fmtDateFull(balanceDueIso)}` : "Due before check-in"}
              amount={fmtMoney(balance)}
            />
          )}
        </div>

        {!isPaid && !isOverdue && !isApproaching && balanceDueIso && (
          <p
            className="mt-4"
            style={{
              fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
              fontStyle: "italic",
              fontSize: 12,
              color: "#9A9188",
            }}
          >
            Your card will be charged automatically on {fmtDateFull(balanceDueIso)}. Nothing to do.
          </p>
        )}

        {!isPaid && (
          <>
            <Divider />
            {/* SECTION E — Pay action */}
            <PayBalanceArea
              reservation={r}
              balance={balance}
              isApproaching={isApproaching}
              isOverdue={isOverdue}
              balanceDueIso={balanceDueIso}
              token={extras.token}
            />
          </>
        )}

        <Divider />

        {/* SECTION F — Cancellation policy */}
        <SectionLabel>CANCELLATION POLICY</SectionLabel>
        <p
          className="mt-2"
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 12,
            color: "#9A9188",
            lineHeight: 1.5,
          }}
        >
          Cancellation is possible up to 45 days prior to the first check-in date of your stay. After that time, the reservation is fully non-refundable.
        </p>
      </div>

      {/* SECTION G — Footer */}
      <div className="mt-8 text-center">
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
            fontSize: 16,
            color: "#6B6B6B",
          }}
        >
          We look forward to welcoming you.
        </p>
        <a
          href="https://gilbertsvillefarmhouse.com"
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 11,
            color: "#9A9188",
          }}
          className="mt-2 inline-block hover:text-[#2C3E2D]"
        >
          gilbertsvillefarmhouse.com
        </a>
      </div>
    </div>
  );
}

function RefundedCard({ reservation }: { reservation: Reservation }) {
  const r = reservation;
  const refundDateIso = r.refundedAt ? r.refundedAt.slice(0, 10) : null;
  const isFullRefund =
    r.refundAmount > 0 && Math.abs(r.refundAmount - r.totalAmount) < 0.5;
  return (
    <div className="mx-auto max-w-[600px]">
      <div className="rounded-[4px] border border-[#E8E2D9] bg-white p-5 sm:p-8 md:p-12">
        <span
          style={{
            display: "inline-block",
            padding: "4px 12px",
            backgroundColor: "#2C3E2D",
            borderRadius: 2,
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#C9A84C",
            fontWeight: 500,
          }}
        >
          Refund processed
        </span>

        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 28,
            color: "#1A1A1A",
            margin: "20px 0 0",
            lineHeight: 1.2,
          }}
        >
          {r.guestName}, your refund is on the way.
        </h1>
        {r.weddingName && (
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: "italic",
              fontSize: 18,
              color: "#6B6B6B",
              marginTop: 6,
            }}
          >
            {r.weddingName}
          </p>
        )}

        <Divider />

        <SectionLabel>REFUND</SectionLabel>
        <div className="mt-3 space-y-2">
          <InvoiceRow
            label={isFullRefund ? "Full refund" : "Refund"}
            value={fmtMoney(r.refundAmount)}
          />
          {refundDateIso && (
            <div
              style={{
                fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
                fontSize: 13,
                color: "#6B6B6B",
              }}
            >
              Issued {fmtDateFull(refundDateIso)}
            </div>
          )}
          {r.refundReason && (
            <div
              style={{
                fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
                fontSize: 13,
                color: "#6B6B6B",
              }}
            >
              {r.refundReason}
            </div>
          )}
        </div>

        <p
          className="mt-6"
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 15,
            color: "#3A3A3A",
            lineHeight: 1.6,
          }}
        >
          Please allow 5–10 business days for the refund to appear on your statement.
        </p>

        {r.sectionName && (
          <>
            <Divider />
            <SectionLabel>ORIGINAL RESERVATION</SectionLabel>
            <div className="mt-2">
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 20,
                  color: "#1A1A1A",
                }}
              >
                {r.sectionName}
              </div>
              <div
                style={{
                  fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
                  fontSize: 14,
                  color: "#3A3A3A",
                  marginTop: 4,
                }}
              >
                {fmtStayRange(r.checkInDate)} → {fmtStayRange(r.checkOutDate)}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 text-center">
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
            fontSize: 16,
            color: "#6B6B6B",
          }}
        >
          We hope to welcome you another time.
        </p>
        <a
          href="https://gilbertsvillefarmhouse.com"
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 11,
            color: "#9A9188",
          }}
          className="mt-2 inline-block hover:text-[#2C3E2D]"
        >
          gilbertsvillefarmhouse.com
        </a>
      </div>
    </div>
  );
}

function CoveredCard({
  reservation,
  payerName,
}: {
  reservation: Reservation;
  payerName: string | null;
}) {
  const r = reservation;
  return (
    <div className="mx-auto max-w-[600px]">
      <div className="rounded-[4px] border border-[#E8E2D9] bg-white p-5 sm:p-8 md:p-12">
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 28,
            color: "#1A1A1A",
            margin: 0,
          }}
        >
          {r.guestName}, your room is taken care of.
        </h1>
        {r.weddingName && (
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: "italic",
              fontSize: 18,
              color: "#6B6B6B",
              marginTop: 6,
            }}
          >
            {r.weddingName}
          </p>
        )}

        <div className="mt-6">
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 20,
              color: "#1A1A1A",
            }}
          >
            {r.sectionName}
          </div>
          <div
            style={{
              fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
              fontSize: 14,
              color: "#3A3A3A",
              marginTop: 4,
            }}
          >
            {fmtStayRange(r.checkInDate)} → {fmtStayRange(r.checkOutDate)}
          </div>
        </div>

        <p
          className="mt-6"
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 15,
            color: "#3A3A3A",
            lineHeight: 1.6,
          }}
        >
          {(payerName ? payerName.split(/\s+/)[0] : "Someone")} has reserved
          your room for the weekend. You're confirmed.
        </p>

        <p
          className="mt-8"
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 14,
            color: "#6B6B6B",
          }}
        >
          Your planning team will be in touch with arrival details.
        </p>
      </div>

      <div className="mt-8 text-center">
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
            fontSize: 16,
            color: "#6B6B6B",
          }}
        >
          We look forward to welcoming you.
        </p>
        <a
          href="https://gilbertsvillefarmhouse.com"
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 11,
            color: "#9A9188",
          }}
          className="mt-2 inline-block hover:text-[#2C3E2D]"
        >
          gilbertsvillefarmhouse.com
        </a>
      </div>
    </div>
  );
}

function PayBalanceArea({
  reservation,
  balance,
  isApproaching,
  isOverdue,
  balanceDueIso,
  token,
}: {
  reservation: Reservation;
  balance: number;
  isApproaching: boolean;
  isOverdue: boolean;
  balanceDueIso: string | null;
  token: string | null;
}) {
  const { eventSlug, sectionSlug } = Route.useParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startBalanceCheckout = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { url } = await createCheckoutSession({
        bookingId: reservation.bookingId,
        eventSlug,
        sectionSlug,
        paymentType: "balance",
      });
      if (url) {
        window.location.href = url;
        return;
      }
      setErr("Could not start checkout. Please try again.");
    } catch (e) {
      console.error("balance checkout failed", e);
      setErr("Could not start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (isOverdue) {
    return (
      <div className="space-y-3">
        <button
          onClick={startBalanceCheckout}
          disabled={busy}
          className="w-full rounded bg-[#2C3E2D] px-4 py-3 transition-colors hover:bg-[#2C3E2D]/90 disabled:opacity-50"
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 13,
            color: "#FAF8F4",
            letterSpacing: "0.04em",
          }}
        >
          {busy ? "Opening checkout…" : `Pay now — ${fmtMoney(balance)}`}
        </button>
        {token && (
          <a
            href={`/update-payment/${token}`}
            className="block w-full rounded border border-[#E8E2D9] px-4 py-3 text-center transition-colors hover:border-[#C9A84C]"
            style={{
              fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
              fontSize: 13,
              color: "#6B6B6B",
            }}
          >
            Update payment method
          </a>
        )}
        <p
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 12,
            color: "#9A9188",
          }}
        >
          Need help? Reach out to your planning team.
        </p>
        {err && <p className="text-xs text-[#C0392B]">{err}</p>}
      </div>
    );
  }

  if (isApproaching) {
    return (
      <div className="space-y-2">
        <button
          onClick={startBalanceCheckout}
          disabled={busy}
          className="w-full rounded bg-[#2C3E2D] px-4 py-3 transition-colors hover:bg-[#2C3E2D]/90 disabled:opacity-50"
          style={{
            fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
            fontSize: 13,
            color: "#FAF8F4",
            letterSpacing: "0.04em",
          }}
        >
          {busy ? "Opening checkout…" : `Pay balance now — ${fmtMoney(balance)}`}
        </button>
        {balanceDueIso && (
          <p
            style={{
              fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
              fontSize: 12,
              color: "#9A9188",
            }}
          >
            Or your card will be charged automatically on {fmtDateFull(balanceDueIso)}.
          </p>
        )}
        {err && <p className="text-xs text-[#C0392B]">{err}</p>}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={startBalanceCheckout}
        disabled={busy}
        className="w-full rounded border border-[#E8E2D9] px-4 py-3 transition-colors hover:border-[#C9A84C] hover:text-[#2C3E2D] disabled:opacity-50"
        style={{
          fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
          fontSize: 13,
          color: "#6B6B6B",
        }}
      >
        {busy ? "Opening checkout…" : `Pay balance early — ${fmtMoney(balance)}`}
      </button>
      {err && <p className="mt-2 text-xs text-[#C0392B]">{err}</p>}
    </div>
  );
}

function SuccessBanner({ guestName, email, isDeposit }: { guestName: string; email: string; isDeposit: boolean }) {
  const [opacity, setOpacity] = useState(1);
  const firstName = guestName.split(/\s+/)[0];
  useEffect(() => {
    const t = setTimeout(() => setOpacity(0.9), 10000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="mb-8 rounded-[4px] p-5 sm:p-8 text-center transition-opacity duration-1000"
      style={{ backgroundColor: "#2C3E2D", opacity }}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="h-10 w-10">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2
        className="mt-2"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 24,
          color: "#FFFFFF",
          margin: 0,
          marginTop: 12,
        }}
      >
        You're all set, {firstName}.
      </h2>
      <p
        style={{
          fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
          fontSize: 13,
          color: "#C9A84C",
          marginTop: 6,
        }}
      >
        A confirmation has been sent to <span className="break-all">{email}</span>
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-6"
      style={{
        fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
        fontSize: 11,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: "#9A9188",
        margin: 0,
        marginTop: 24,
      }}
    >
      {children}
    </p>
  );
}

function Divider() {
  return <div className="my-6 h-px bg-[#E8E2D9]" />;
}

function InvoiceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span
        className="min-w-0 flex-1 break-words"
        style={{
          fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
          fontSize: 14,
          color: "#3A3A3A",
        }}
      >
        {label}
      </span>
      <span
        className="shrink-0 tabular-nums"
        style={{
          fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
          fontSize: 14,
          color: "#1A1A1A",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PaymentRow({
  status,
  label,
  sub,
  amount,
  amountMuted,
  amountStrong,
  amountTone,
  subTone,
}: {
  status: "paid" | "upcoming" | "approaching" | "overdue";
  label: string;
  sub: string;
  amount: string;
  amountMuted?: boolean;
  amountStrong?: boolean;
  amountTone?: "overdue";
  subTone?: "gold";
}) {
  let icon: React.ReactNode;
  if (status === "paid") {
    icon = (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: "#2C3E2D" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="h-3 w-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  } else if (status === "approaching") {
    icon = (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: "#C9A84C" }}
      />
    );
  } else if (status === "overdue") {
    icon = (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: "#C0392B" }}
      >
        <span className="text-[10px] font-bold text-white">!</span>
      </span>
    );
  } else {
    icon = (
      <span
        className="block h-5 w-5 rounded-full border"
        style={{ borderColor: "#E8E2D9" }}
      />
    );
  }

  const labelColor =
    amountTone === "overdue" ? "#C0392B" : status === "approaching" ? "#1A1A1A" : "#3A3A3A";
  const subColor =
    subTone === "gold" ? "#C9A84C" : "#9A9188";
  const amountColor =
    amountTone === "overdue" ? "#C0392B" : amountMuted ? "#9A9188" : "#1A1A1A";

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5">{icon}</span>
        <div className="min-w-0">
          <div
            style={{
              fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
              fontSize: 14,
              color: labelColor,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
              fontSize: 12,
              color: subColor,
              marginTop: 2,
            }}
          >
            {sub}
          </div>
        </div>
      </div>
      <span
        className="tabular-nums"
        style={{
          fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
          fontSize: 14,
          fontWeight: amountStrong ? 600 : 400,
          color: amountColor,
        }}
      >
        {amount}
      </span>
    </div>
  );
}

const fmtStayRange = (d: string | null | undefined) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";