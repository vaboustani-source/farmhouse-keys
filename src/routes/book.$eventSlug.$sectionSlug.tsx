import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") setShowSuccess(true);
  }, []);

  if (showSuccess) {
    return <ConfirmationView eventSlug={eventSlug} sectionSlug={sectionSlug} />;
  }

  // Restore session
  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans text-[#1A1A1A]">
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
              className="ml-3 text-xs uppercase tracking-[0.16em] text-[#7a6420]/70 hover:text-[#7a6420]"
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
      <h1 className="font-serif text-4xl font-medium md:text-5xl">Welcome to your weekend.</h1>
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded border border-[#E8E2D9] bg-white px-4 py-3 text-base text-[#1A1A1A] focus:border-[#2C3E2D] focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !email}
          className="w-full rounded bg-[#2C3E2D] px-4 py-3 text-sm uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#2C3E2D]/90 disabled:opacity-50"
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
        className="mb-6 text-xs uppercase tracking-[0.16em] text-[#6B6B6B] hover:text-[#1A1A1A]"
      >
        ← Back
      </button>

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
          <form onSubmit={lookupSecondHandler} className="mt-4 flex gap-2">
            <input
              type="email"
              value={secondaryEmail}
              onChange={(e) => setSecondaryEmail(e.target.value)}
              placeholder="guest@example.com"
              className="flex-1 rounded border border-[#E8E2D9] bg-white px-3 py-2 text-sm focus:border-[#2C3E2D] focus:outline-none"
            />
            <button
              type="submit"
              disabled={lookingUpSecondary || !secondaryEmail}
              className="rounded border border-[#2C3E2D] px-4 py-2 text-xs uppercase tracking-[0.16em] text-[#2C3E2D] disabled:opacity-50"
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
              className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B] hover:text-[#1A1A1A]"
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
    <div className="flex justify-between">
      <span className="text-[#6B6B6B]">{label}</span>
      <span className="tabular-nums">{value}</span>
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
  const fetcher = useServerFn(fetchSessionConfirmation);
  const [bookings, setBookings] = useState<ConfirmationBookings>([]);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Clear any saved booking session data
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("gfh_booking_") || k.startsWith("gfh_stripe_session_"))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setLoading(false);
      setTimedOut(true);
      return;
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const { bookings } = await fetcher({ data: { sessionId } });
        const ready = bookings.find(
          (b) =>
            b.payment_status === "paid" ||
            b.payment_status === "deposit_paid" ||
            b.payment_status === "covered",
        );
        if (ready) {
          setBookings(bookings);
          setLoading(false);
          return;
        }
      } catch {}
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
  }, [fetcher]);

  const primary = bookings.find((b) => b.is_primary || !b.covered_by_booking_id);
  const secondary = bookings.find((b) => b.covered_by_booking_id);

  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans text-[#1A1A1A]">
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Wordmark />

        {loading && (
          <p className="mt-16 text-sm text-[#6B6B6B]">Confirming your reservation…</p>
        )}

        {!loading && timedOut && (
          <div className="mt-16">
            <h1 className="font-serif text-3xl font-medium md:text-4xl">
              Your payment was received.
            </h1>
            <p className="mt-3 text-sm text-[#6B6B6B]">
              Your confirmation is on its way — check your email shortly.
            </p>
          </div>
        )}

        {!loading && !timedOut && primary && (
          <ConfirmationContent primary={primary} secondary={secondary ?? null} />
        )}
      </div>
    </div>
  );
}

function ConfirmationContent({
  primary,
  secondary,
}: {
  primary: NonNullable<ConfirmationBookings[number]>;
  secondary: ConfirmationBookings[number] | null;
}) {
  const isDeposit = primary.payment_status === "deposit_paid";
  const total = Number(primary.total_amount) || 0;
  const half = total / 2;
  const checkIn = primary.event?.check_in_date ?? null;
  const nextPaymentDate = checkIn ? fmtDateFull(addDays(checkIn, -30)) : "";

  return (
    <>
      <div className="mt-8 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#E8F0E5] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#2C3E2D]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2C3E2D]" />
          {isDeposit ? "Deposit confirmed" : "Confirmed"}
        </span>
      </div>

      <h1 className="mt-6 font-serif text-4xl font-medium md:text-5xl">
        {isDeposit ? "Your room is reserved." : "You're confirmed."}
      </h1>

      {primary.event?.wedding_name && (
        <p
          className="mt-3 text-xl text-[#6B6B6B]"
          style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}
        >
          {primary.event.wedding_name}
        </p>
      )}

      <div className="mt-10 rounded-md border border-[#E8E2D9] bg-white p-6 text-left">
        <div className="font-serif text-xl">{primary.section?.section_name}</div>
        <div className="mt-3 space-y-1 text-sm">
          <Row label="Check-in" value={fmtDate(primary.event?.check_in_date)} />
          <Row label="Check-out" value={fmtDate(primary.event?.check_out_date)} />
          {isDeposit ? (
            <>
              <Row label="Amount charged today" value={fmtMoney(half)} />
              <Row label="Next payment due" value={fmtMoney(half)} />
              {nextPaymentDate && <Row label="Payment date" value={nextPaymentDate} />}
            </>
          ) : (
            <Row label="Paid in full" value={fmtMoney(total)} />
          )}
        </div>
        {isDeposit && (
          <p className="mt-4 text-xs text-[#6B6B6B]">
            Your card will be charged automatically — no action needed.
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-[#6B6B6B]">
        A confirmation has been sent to {primary.guest_email}.
      </p>

      {secondary && (
        <div className="mt-6 rounded-md border border-[#E8E2D9] bg-white p-6 text-left">
          <div className="font-serif text-xl">
            {secondary.guest_name}'s room is confirmed too.
          </div>
          <p className="mt-3 text-xs text-[#6B6B6B]">
            A confirmation has been sent to {secondary.guest_email}.
          </p>
        </div>
      )}

      <p className="mt-12 font-serif text-lg text-[#6B6B6B]">
        We look forward to welcoming you.
      </p>
      <a
        href="https://gilbertsvillefarmhouse.com"
        className="mt-2 inline-block text-xs uppercase tracking-[0.16em] text-[#2C3E2D] hover:text-[#C9A84C]"
      >
        gilbertsvillefarmhouse.com
      </a>
    </>
  );
}