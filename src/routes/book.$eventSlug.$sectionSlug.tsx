import { createFileRoute } from "@tanstack/react-router";
import { Component, type ReactNode, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  lookupBooking,
  lookupSecondaryGuest,
  getSectionAddons,
  createCheckoutSession,
} from "@/lib/booking.functions";

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

  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans text-[#1A1A1A]">
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <Wordmark />
        {step === 2 && booking && (
          <div className="mt-10">
            <ProgressDots step={2} />
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
  const lookup = useServerFn(lookupBooking);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusBooking, setStatusBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayedError = error ?? externalError ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { booking } = await lookup({ data: { email: email.trim(), eventSlug, sectionSlug } });
      if (!booking) {
        setError("We don't have a reservation held for that email. Please reach out to your planning team.");
        return;
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

class ReviewErrorBoundary extends Component<
  { children: ReactNode; onError: (err: Error) => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function BookingStatusCard({ booking }: { booking: Booking }) {
  let heading = "";
  let detail = "";
  if (booking.payment_status === "deposit_paid") {
    heading = "Your deposit is confirmed.";
    detail = `Your final payment will be requested before ${fmtDate(booking.check_in_date)}.`;
  } else if (booking.payment_status === "paid") {
    heading = "You're all set.";
    detail = `Your room is confirmed — we'll see you in ${fmtDate(booking.check_in_date)}.`;
  } else if (booking.payment_status === "covered") {
    heading = "Your room has been taken care of.";
    detail = "You're confirmed — see you soon.";
  }
  return (
    <div className="mx-auto mt-12 max-w-md rounded-md border border-[#E8E2D9] bg-white p-8 text-center">
      <h1 className="font-serif text-3xl font-medium">{heading}</h1>
      <p className="mt-3 text-sm text-[#6B6B6B]">{detail}</p>
      <div className="mt-6 border-t border-[#E8E2D9] pt-6 text-left text-sm">
        <div className="font-serif text-lg">{booking.section_name}</div>
        <div className="mt-1 text-xs text-[#6B6B6B]">
          {fmtDate(booking.check_in_date)} → {fmtDate(booking.check_out_date)}
        </div>
      </div>
    </div>
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
  const lookupSecond = useServerFn(lookupSecondaryGuest);
  const checkout = useServerFn(createCheckoutSession);

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
      const res = await lookupSecond({
        data: { email: secondaryEmail.trim(), eventSlug, excludeBookingId: booking.booking_id },
      });
      if ((res as { sameAsPrimary?: boolean }).sameAsPrimary) {
        setSecondaryLookupErr("That's you — enter a different guest's email.");
        return;
      }
      if (!res.booking) {
        setSecondaryLookupErr("That email isn't on the guest list for this weekend.");
        return;
      }
      if (res.booking.payment_status !== "pending") {
        setSecondaryLookupErr("This guest's room is already reserved.");
        return;
      }
      setSecondary(res.booking);
      // Secondary add-ons skipped for now — only base lodging is covered.
    } finally {
      setLookingUpSecondary(false);
    }
  };

  const reserve = async () => {
    setSubmitting(true);
    try {
      const { url } = await checkout({
        data: {
          bookingId: booking.booking_id,
          addonIds: selectedIds.filter((id) => !addons.find((a) => a.id === id)?.is_required),
          secondaryBookingId: secondary?.booking_id ?? null,
          secondaryAddonIds: secondarySelectedIds.filter(
            (id) => !secondaryAddons.find((a) => a.id === id)?.is_required,
          ),
          eventSlug,
          sectionSlug,
          cotRequested,
        },
      });
      if (url) window.location.href = url;
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

      <button
        onClick={reserve}
        disabled={submitting}
        className="mt-6 w-full rounded bg-[#2C3E2D] px-4 py-4 text-sm uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#2C3E2D]/90 disabled:opacity-50"
      >
        {submitting ? "Confirming with Stripe…" : secondary ? "Reserve our rooms" : "Reserve my room"}
      </button>
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