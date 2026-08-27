import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  getPopupEvent,
  createPopupBookingFn,
  checkPopupWaitlist,
  setPopupPaymentChoice,
  type PopupEventPayload,
  type PopupTier,
  type PopupItineraryItem,
} from "@/lib/popup.functions";
import { getSectionAddons, fetchSessionConfirmation } from "@/lib/booking.functions";
import { createCheckoutSession, checkSessionStatus } from "@/lib/checkout";
import { ReviewErrorBoundary } from "@/components/ReviewErrorBoundary";

export const Route = createFileRoute("/stay/$eventSlug")({
  component: PopupWeekendPage,
});

type Addon = Awaited<ReturnType<typeof getSectionAddons>>["addons"][number];

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  });
const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";
/** Timestamps (booking windows) rendered as their Eastern-time day. */
const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "America/New_York",
      })
    : "";

function Wordmark() {
  return (
    <div className="text-center">
      <div className="font-serif text-2xl tracking-wide text-[#2C3E2D]">
        Gilbertsville Farmhouse
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[#6B6B6B]">
        A private estate
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.24em] text-[#C9A84C]">{children}</div>;
}

function cancellationPolicy(ev: NonNullable<PopupEventPayload["event"]>): string {
  if (ev.cancel_by_date) {
    return `Free cancellation until ${fmtDate(ev.cancel_by_date)}. After that, the reservation is fully non-refundable.`;
  }
  return "Cancellation is possible up to 45 days prior to check-in. After that time, the reservation is fully non-refundable.";
}

const FULL_STORY_URL = "https://gilbertsvillefarmhouse.com/couples-weekend";

const CONTACT_LINE = (
  <>
    Questions? Email{" "}
    <a className="underline" href="mailto:stay@gilbertsvillefarmhouse.com">
      stay@gilbertsvillefarmhouse.com
    </a>{" "}
    and we'll take care of you.
  </>
);

/* ───────────────────────── Page shell + state machine ───────────────────────── */

type Step =
  | { kind: "landing" }
  | { kind: "details"; tier: PopupTier }
  | {
      kind: "review";
      tier: PopupTier;
      bookingId: string;
      guestName: string;
      guestEmail: string;
      baseAmount: number;
      rateType: "waitlist" | "regular";
    };

function PopupWeekendPage() {
  const { eventSlug } = Route.useParams();
  const fetchEvent = getPopupEvent;

  const [payload, setPayload] = useState<PopupEventPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>({ kind: "landing" });
  const [banner, setBanner] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") setShowSuccess(true);
  }, []);

  const loadEvent = () => {
    fetchEvent({ data: { slug: eventSlug } })
      .then(setPayload)
      .catch((err) => {
        console.error("getPopupEvent failed", err);
        setPayload({ event: null, tiers: [], itinerary: [] });
      })
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadEvent, [eventSlug]);

  // Returning from Stripe with cancelled=true: paid-then-back-button shows
  // the confirmation; a truly abandoned session gets a soft banner.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("cancelled") === "true" && sessionId) {
      checkSessionStatus(sessionId)
        .then(({ status }) => {
          if (status === "complete") {
            window.location.replace(`/stay/${eventSlug}?success=true&session_id=${sessionId}`);
            return;
          }
          setBanner("Your checkout session expired — your room is still available below.");
          window.history.replaceState({}, "", `/stay/${eventSlug}`);
        })
        .catch(() => {
          setBanner("Your checkout session expired — your room is still available below.");
          window.history.replaceState({}, "", `/stay/${eventSlug}`);
        });
    }
  }, [eventSlug]);

  if (mounted && showSuccess) {
    return <PopupConfirmation eventSlug={eventSlug} payload={payload} />;
  }

  return (
    <div className="min-h-dvh bg-[#FAF8F4] font-sans text-[#1A1A1A]">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <Wordmark />

        {banner && step.kind === "landing" && (
          <div className="mx-auto mt-6 max-w-xl rounded-md border border-[#C9A84C]/40 bg-[#FBF6E7] p-4 text-center text-sm text-[#7a6420]">
            {banner}
          </div>
        )}

        {loading && <p className="mt-20 text-center text-sm text-[#6B6B6B]">Setting the table…</p>}

        {!loading && (!payload?.event || payload.event.status !== "active") && (
          <div className="mt-20 text-center">
            <h1 className="font-serif text-3xl font-medium md:text-4xl">
              This weekend isn't open for reservations.
            </h1>
            <p className="mt-3 text-sm text-[#6B6B6B]">{CONTACT_LINE}</p>
          </div>
        )}

        {!loading && payload?.event && payload.event.status === "active" && (
          <>
            {step.kind === "landing" && (
              <Landing
                payload={payload}
                onReserve={(tier) => {
                  setBanner(null);
                  setStep({ kind: "details", tier });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            )}
            {step.kind === "details" && (
              <DetailsStep
                eventSlug={eventSlug}
                payload={payload}
                tier={step.tier}
                onBack={() => setStep({ kind: "landing" })}
                onSoldOut={() => {
                  loadEvent();
                  setBanner("That tier just sold out — here's what's still available.");
                  setStep({ kind: "landing" });
                }}
                onReserved={(bookingId, guestName, guestEmail, baseAmount, rateType) =>
                  setStep({
                    kind: "review",
                    tier: step.tier,
                    bookingId,
                    guestName,
                    guestEmail,
                    baseAmount,
                    rateType,
                  })
                }
              />
            )}
            {step.kind === "review" && (
              <ReviewErrorBoundary
                onError={(err) => {
                  console.error("Popup review crashed", err);
                  setStep({ kind: "landing" });
                }}
              >
                <PopupReviewStep
                  eventSlug={eventSlug}
                  payload={payload}
                  tier={step.tier}
                  bookingId={step.bookingId}
                  guestName={step.guestName}
                  baseAmount={step.baseAmount}
                  rateType={step.rateType}
                  onBack={() => setStep({ kind: "details", tier: step.tier })}
                />
              </ReviewErrorBoundary>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Landing: hero + itinerary + tiers ───────────────────────── */

function Landing({
  payload,
  onReserve,
}: {
  payload: PopupEventPayload;
  onReserve: (tier: PopupTier) => void;
}) {
  const ev = payload.event!;
  const phase = ev.phase;

  return (
    <div>
      {/* Hero — the full story lives on /couples-weekend; this page books it. */}
      <div className="mt-12 text-center">
        <SectionLabel>A weekend for two</SectionLabel>
        <h1 className="mt-3 font-serif text-4xl font-medium md:text-5xl">{ev.title}</h1>
        <p className="mt-4 text-sm text-[#3A3A3A]">
          {fmtDate(ev.check_in_date)} → {fmtDate(ev.check_out_date)} · {ev.nights}{" "}
          {ev.nights === 1 ? "night" : "nights"} at the estate
        </p>
        {ev.hero_intro && (
          <p className="mx-auto mt-6 max-w-xl font-serif text-lg italic leading-relaxed text-[#6B6B6B]">
            {ev.hero_intro}
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href="#tiers"
            className="inline-block rounded border border-[#C9A84C] px-6 py-3 text-xs uppercase tracking-[0.16em] text-[#7a6420] transition-colors hover:bg-[#C9A84C]/10"
          >
            Choose your weekend
          </a>
          <a
            href={FULL_STORY_URL}
            className="text-xs text-[#6B6B6B] underline underline-offset-2 hover:text-[#1A1A1A]"
          >
            Read the full weekend, hour by hour →
          </a>
        </div>
      </div>

      {/* Booking-window notice */}
      {phase === "preopen" && ev.waitlist_opens_at && (
        <div className="mx-auto mt-10 max-w-xl rounded-md border border-[#C9A84C]/40 bg-[#FBF6E7] p-4 text-center text-sm text-[#7a6420]">
          Booking opens {fmtDateTime(ev.waitlist_opens_at)} for waitlist members
          {ev.public_opens_at ? ` — and to everyone ${fmtDateTime(ev.public_opens_at)}` : ""}.
        </div>
      )}
      {phase === "waitlist_only" && (
        <div className="mx-auto mt-10 max-w-xl rounded-md border border-[#C9A84C]/40 bg-[#FBF6E7] p-4 text-center text-sm text-[#7a6420]">
          Waitlist first access — book today with the email you joined with.
          {ev.public_opens_at ? ` Public booking opens ${fmtDateTime(ev.public_opens_at)}.` : ""}
        </div>
      )}

      {/* Tier cards */}
      <div id="tiers" className="mt-14 scroll-mt-8">
        <h2 className="text-center font-serif text-3xl">Choose your weekend</h2>
        <p className="mt-2 text-center text-sm text-[#6B6B6B]">
          Every tier includes your lodging for the full weekend. Your exact room is assigned by the
          estate before arrival.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {payload.tiers.map((tier, i) => (
            <TierCard
              key={tier.id}
              tier={tier}
              itinerary={payload.itinerary}
              tierIndex={i}
              featured={i === payload.tiers.length - 1}
              phase={phase}
              onReserve={() => onReserve(tier)}
            />
          ))}
        </div>
      </div>

      <p className="mt-12 text-center text-xs text-[#6B6B6B]">{CONTACT_LINE}</p>
    </div>
  );
}

function TierCard({
  tier,
  itinerary,
  tierIndex,
  featured,
  phase,
  onReserve,
}: {
  tier: PopupTier;
  itinerary: PopupItineraryItem[];
  tierIndex: number;
  featured: boolean;
  phase: "preopen" | "waitlist_only" | "public";
  onReserve: () => void;
}) {
  const included = itinerary.filter((it) => {
    const flags = [it.tier1_included, it.tier2_included, it.tier3_included];
    return flags[tierIndex];
  });
  const soldOut = tier.remaining <= 0;
  const regular = tier.regular_package_price != null ? Number(tier.regular_package_price) : null;
  const promo = tier.promo_package_price != null ? Number(tier.promo_package_price) : null;
  const hasWaitlistRate = promo != null && regular != null && promo < regular;
  // Before public opening, only waitlist members can book — show their rate.
  // Once public, the headline price is the regular rate; a matched waitlist
  // email still gets the lower rate, verified at checkout.
  const headline =
    phase === "public" ? (regular ?? tier.selling_price) : (promo ?? tier.selling_price);
  // Remaining counts against the displayed stock (display_stock_start),
  // while the real total_rooms cap prevents overbooking server-side.
  const showScarcity = tier.show_scarcity;

  return (
    <div
      className={`relative flex flex-col rounded-[4px] border bg-white p-6 ${
        featured ? "border-[#C9A84C]" : "border-[#E8E2D9]"
      } ${soldOut ? "opacity-70" : ""}`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#C9A84C] px-3 py-0.5 text-[10px] uppercase tracking-wider text-white">
          Most popular
        </div>
      )}
      <h3 className="font-serif text-2xl leading-snug">{tier.section_name}</h3>
      {tier.tagline && <p className="mt-1 text-xs italic text-[#6B6B6B]">{tier.tagline}</p>}

      <ul className="mt-4 flex-1 space-y-1.5">
        {included.map((it) => (
          <li key={it.id} className="flex gap-2 text-xs text-[#3A3A3A]">
            <span className="text-[#C9A84C]">✓</span>
            <span>
              {it.activity}
              {it.note ? <span className="italic text-[#6B6B6B]"> — {it.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-[#E8E2D9] pt-4">
        {phase !== "public" && hasWaitlistRate && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6B6B6B] line-through">{fmtMoney(regular!)}</span>
            <span className="rounded-full bg-[#C9A84C]/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#7a6420]">
              Waitlist rate
            </span>
          </div>
        )}
        <div className="font-serif text-3xl text-[#2C3E2D]">{fmtMoney(headline)}</div>
        <div className="text-xs text-[#6B6B6B]">
          per couple · {tier.nights} {tier.nights === 1 ? "night" : "nights"} · before fees &amp;
          tax
        </div>
        {phase === "public" && hasWaitlistRate && (
          <div className="mt-1 text-xs text-[#7a6420]">
            Waitlist members: {fmtMoney(promo!)} — honored at checkout.
          </div>
        )}
        {showScarcity && (
          <div className="mt-2 text-xs text-[#6B6B6B]">
            {soldOut
              ? "Sold out"
              : tier.remaining <= 3
                ? `Only ${tier.remaining} ${tier.remaining === 1 ? "room" : "rooms"} left`
                : `${tier.remaining} rooms left`}
          </div>
        )}
        <button
          onClick={onReserve}
          disabled={soldOut || phase === "preopen"}
          className="mt-4 w-full rounded bg-[#2C3E2D] px-4 py-3 text-xs uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#2C3E2D]/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {soldOut
            ? "Sold out"
            : phase === "preopen"
              ? "Booking opens soon"
              : "Reserve this weekend"}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 2: guest details ───────────────────────── */

function DetailsStep({
  eventSlug,
  payload,
  tier,
  onBack,
  onSoldOut,
  onReserved,
}: {
  eventSlug: string;
  payload: PopupEventPayload;
  tier: PopupTier;
  onBack: () => void;
  onSoldOut: () => void;
  onReserved: (
    bookingId: string,
    guestName: string,
    guestEmail: string,
    baseAmount: number,
    rateType: "waitlist" | "regular",
  ) => void;
}) {
  const createBooking = createPopupBookingFn;
  const ev = payload.event!;
  const [name, setName] = useState("");
  const [name2, setName2] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrZip, setAddrZip] = useState("");
  const [onWaitlist, setOnWaitlist] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore previously entered details (e.g. after an expired checkout)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem(`gfh_popup_guest_${eventSlug}`);
      if (saved) {
        const g = JSON.parse(saved) as {
          name?: string;
          name2?: string;
          email?: string;
          phone?: string;
          addr1?: string;
          addrCity?: string;
          addrState?: string;
          addrZip?: string;
        };
        if (g.name) setName(g.name);
        if (g.name2) setName2(g.name2);
        if (g.email) setEmail(g.email);
        if (g.phone) setPhone(g.phone);
        if (g.addr1) setAddr1(g.addr1);
        if (g.addrCity) setAddrCity(g.addrCity);
        if (g.addrState) setAddrState(g.addrState);
        if (g.addrZip) setAddrZip(g.addrZip);
      }
    } catch {
      /* sessionStorage unavailable — non-fatal */
    }
  }, [eventSlug]);

  // Live waitlist check: a matched email locks in the waitlist rate (the
  // server re-verifies at booking and checkout — this is display only).
  useEffect(() => {
    const candidate = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate)) {
      setOnWaitlist(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      checkPopupWaitlist({ data: { eventSlug, email: candidate } }).then(({ onWaitlist }) => {
        if (!cancelled) setOnWaitlist(onWaitlist);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [email, eventSlug]);

  const regular = tier.regular_package_price != null ? Number(tier.regular_package_price) : null;
  const promo = tier.promo_package_price != null ? Number(tier.promo_package_price) : null;
  const displayPrice = onWaitlist
    ? (promo ?? tier.selling_price)
    : ev.phase === "public"
      ? (regular ?? tier.selling_price)
      : (promo ?? tier.selling_price);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      try {
        sessionStorage.setItem(
          `gfh_popup_guest_${eventSlug}`,
          JSON.stringify({ name, name2, email, phone, addr1, addrCity, addrState, addrZip }),
        );
      } catch {
        /* sessionStorage unavailable — non-fatal */
      }
      const res = await createBooking({
        data: {
          eventSlug,
          sectionId: tier.id,
          guestName: name.trim(),
          guest2Name: name2.trim() || undefined,
          guestEmail: email.trim(),
          guestPhone: phone.trim(),
          addressLine1: addr1.trim(),
          addressCity: addrCity.trim(),
          addressState: addrState.trim(),
          addressZip: addrZip.trim(),
        },
      });
      if (!res.ok) {
        if (res.reason === "sold_out") {
          onSoldOut();
          return;
        }
        if (res.reason === "already_booked") {
          setError(
            "You already have a reservation for this weekend — check your email for the confirmation, or reach out and we'll help.",
          );
          return;
        }
        if (res.reason === "waitlist_only") {
          setError(
            `Right now booking is reserved for our waitlist — use the email you joined the waitlist with${
              ev.public_opens_at
                ? `, or come back ${fmtDateTime(ev.public_opens_at)} when booking opens to everyone`
                : ""
            }.`,
          );
          return;
        }
        if (res.reason === "not_open") {
          setError(
            ev.waitlist_opens_at
              ? `Booking hasn't opened yet — waitlist members can book starting ${fmtDateTime(ev.waitlist_opens_at)}.`
              : "Booking hasn't opened yet.",
          );
          return;
        }
        setError("Something went wrong — please try again.");
        return;
      }
      onReserved(
        res.booking.id,
        res.booking.guest_name,
        res.booking.guest_email,
        res.booking.base_amount,
        res.booking.rate_type,
      );
    } catch (err) {
      console.error("createPopupBooking failed", err);
      setError("Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded border border-[#E8E2D9] bg-white px-4 py-3 text-base focus:border-[#2C3E2D] focus:outline-none";

  return (
    <div className="mx-auto mt-10 max-w-md">
      <button
        onClick={onBack}
        className="mb-6 inline-flex min-h-[44px] items-center -ml-1 px-2 py-2 text-xs uppercase tracking-[0.16em] text-[#6B6B6B] hover:text-[#1A1A1A]"
      >
        ← Compare all packages
      </button>

      <div className="rounded-[4px] border border-[#E8E2D9] bg-white p-6">
        <SectionLabel>Your weekend</SectionLabel>
        <div className="mt-1 font-serif text-2xl">{tier.section_name}</div>
        <div className="mt-1 text-sm text-[#6B6B6B]">
          {fmtDate(ev.check_in_date)} → {fmtDate(ev.check_out_date)} · {fmtMoney(displayPrice)} per
          couple
          {onWaitlist && regular != null && promo != null && promo < regular && (
            <span className="ml-2 text-[#6B6B6B] line-through">{fmtMoney(regular)}</span>
          )}
        </div>
        {onWaitlist && (
          <div className="mt-2 text-xs text-[#7a6420]">
            ✓ You're on the waitlist — your waitlist rate is locked in.
          </div>
        )}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="text"
          required
          autoFocus
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Guest 1 — full name"
          className={inputCls}
        />
        <input
          type="text"
          required
          value={name2}
          onChange={(e) => setName2(e.target.value)}
          placeholder="Guest 2 — full name"
          className={inputCls}
        />
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputCls}
        />
        <input
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          className={inputCls}
        />
        <input
          type="text"
          required
          autoComplete="street-address"
          value={addr1}
          onChange={(e) => setAddr1(e.target.value)}
          placeholder="Street address (apt / unit welcome)"
          className={inputCls}
        />
        <div className="grid grid-cols-[1fr_72px_96px] gap-3">
          <input
            type="text"
            required
            autoComplete="address-level2"
            value={addrCity}
            onChange={(e) => setAddrCity(e.target.value)}
            placeholder="City"
            className={inputCls}
          />
          <input
            type="text"
            required
            autoComplete="address-level1"
            maxLength={2}
            value={addrState}
            onChange={(e) => setAddrState(e.target.value.toUpperCase())}
            placeholder="ST"
            className={inputCls}
          />
          <input
            type="text"
            required
            autoComplete="postal-code"
            inputMode="numeric"
            value={addrZip}
            onChange={(e) => setAddrZip(e.target.value)}
            placeholder="ZIP"
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={
            submitting ||
            !name ||
            !name2 ||
            !email ||
            !phone ||
            !addr1 ||
            !addrCity ||
            !addrState ||
            !addrZip
          }
          className="w-full rounded bg-[#2C3E2D] px-4 py-3 min-h-[44px] text-sm uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#2C3E2D]/90 disabled:opacity-50"
        >
          {submitting ? "Holding your room…" : "Continue"}
        </button>
        {error && <p className="pt-2 text-sm text-[#6B6B6B]">{error}</p>}
        <p className="pt-1 text-center text-xs text-[#6B6B6B]">
          Nothing is charged yet — your room is held while you review.
        </p>
      </form>
    </div>
  );
}

/* ───────────────────────── Step 3: review + add-ons + pay ───────────────────────── */

function PopupReviewStep({
  eventSlug,
  payload,
  tier,
  bookingId,
  guestName,
  baseAmount,
  rateType,
  onBack,
}: {
  eventSlug: string;
  payload: PopupEventPayload;
  tier: PopupTier;
  bookingId: string;
  guestName: string;
  baseAmount: number;
  rateType: "waitlist" | "regular";
  onBack: () => void;
}) {
  const fetchAddons = getSectionAddons;
  const ev = payload.event!;

  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cotRequested, setCotRequested] = useState(false);
  const [schedule, setSchedule] = useState<"full" | "deposit_50_balance_50">("full");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAddons({ data: { sectionId: tier.id } }).then(({ addons }) => {
      setAddons(addons);
      setSelectedIds(addons.filter((a) => a.is_required).map((a) => a.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier.id]);

  const calc = useMemo(() => {
    const nights = tier.nights || 2;
    const base = baseAmount;
    const addonAmt = addons
      .filter((a) => selectedIds.includes(a.id))
      .reduce(
        (sum, a) => sum + Number(a.addon_price) * (a.addon_type === "per_night" ? nights : 1),
        0,
      );
    const cotFee = cotRequested ? (nights <= 1 ? tier.cot_1night_rate : tier.cot_2night_rate) : 0;
    const subtotal = base + addonAmt;
    const resortFee = (subtotal * Number(tier.resort_fee_percent || 0)) / 100;
    const tax = (subtotal + resortFee + cotFee) * 0.08;
    const total = subtotal + resortFee + cotFee + tax;
    return { nights, base, addonAmt, cotFee, resortFee, tax, total };
  }, [tier, addons, selectedIds, cotRequested, baseAmount]);

  const isSplit = schedule === "deposit_50_balance_50";
  const dueToday = isSplit ? calc.total / 2 : calc.total;

  const reserve = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Record the payment choice before checkout so the session is built
      // as full or 50/50 (server re-validates the split cutoff date).
      const choice = await setPopupPaymentChoice({ data: { bookingId, schedule } });
      if (!choice.ok) {
        setError("We couldn't save your payment choice — please try again.");
        return;
      }
      const { url, alreadyPaid, redirectUrl, locked, lockedMessage } = await createCheckoutSession({
        bookingId,
        addonIds: selectedIds.filter((id) => !addons.find((a) => a.id === id)?.is_required),
        eventSlug,
        sectionSlug: tier.booking_link_slug ?? tier.id,
        cotRequested,
        returnPath: `/stay/${eventSlug}`,
      });
      if (locked) {
        setError(
          lockedMessage ||
            "Your reservation is already being processed on another device. Complete it there or wait a minute and try again.",
        );
        return;
      }
      if (alreadyPaid && redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      if (url) window.location.href = url;
    } catch (err) {
      console.error("popup checkout failed", err);
      setError("We couldn't open checkout — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-md">
      <button
        onClick={onBack}
        className="mb-6 inline-flex min-h-[44px] items-center -ml-1 px-2 py-2 text-xs uppercase tracking-[0.16em] text-[#6B6B6B] hover:text-[#1A1A1A]"
      >
        ← Back
      </button>

      <div className="mb-6">
        <div className="font-serif text-2xl">{guestName},</div>
        <div className="mt-1 text-sm italic text-[#C9A84C]">Your room is held for you.</div>
      </div>

      <div className="rounded-[4px] border border-[#E8E2D9] bg-white p-6">
        <div className="font-serif text-2xl">{tier.section_name}</div>
        <div className="mt-2 text-sm text-[#6B6B6B]">
          {fmtDate(ev.check_in_date)} → {fmtDate(ev.check_out_date)} · {calc.nights}{" "}
          {calc.nights === 1 ? "night" : "nights"}
        </div>
        {rateType === "waitlist" && (
          <div className="mt-2 text-xs text-[#7a6420]">
            ✓ Waitlist rate applied — {fmtMoney(calc.base)} per couple.
          </div>
        )}
      </div>

      {addons.length > 0 && (
        <div className="mt-4 rounded-[4px] border border-[#E8E2D9] bg-white p-6">
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
                    <div className="text-sm font-medium">
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

      <div className="mt-4 rounded-[4px] border border-[#E8E2D9] bg-white p-6">
        <label className="flex cursor-pointer items-start justify-between gap-4">
          <div className="flex-1">
            <div className="font-serif text-xl">Add a 3rd guest</div>
            <div className="mt-1 text-sm text-[#6B6B6B]">
              Cot setup in your room —{" "}
              {fmtMoney(calc.nights <= 1 ? tier.cot_1night_rate : tier.cot_2night_rate)} for the
              stay.
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

      {/* Payment options */}
      {ev.split_available && ev.balance_due_on && (
        <div className="mt-4 rounded-[4px] border border-[#E8E2D9] bg-white p-6">
          <h2 className="font-serif text-xl">How would you like to pay?</h2>
          <div className="mt-4 space-y-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded border p-4 transition-colors ${
                !isSplit ? "border-[#2C3E2D] bg-[#FAF8F4]" : "border-[#E8E2D9]"
              }`}
            >
              <input
                type="radio"
                name="paymentSchedule"
                checked={!isSplit}
                onChange={() => setSchedule("full")}
                className="mt-1 h-4 w-4 accent-[#2C3E2D]"
              />
              <div>
                <div className="text-sm font-medium">Pay in full today</div>
                <div className="mt-0.5 text-xs text-[#6B6B6B]">
                  {fmtMoney(calc.total)} — done and dusted.
                </div>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded border p-4 transition-colors ${
                isSplit ? "border-[#2C3E2D] bg-[#FAF8F4]" : "border-[#E8E2D9]"
              }`}
            >
              <input
                type="radio"
                name="paymentSchedule"
                checked={isSplit}
                onChange={() => setSchedule("deposit_50_balance_50")}
                className="mt-1 h-4 w-4 accent-[#2C3E2D]"
              />
              <div>
                <div className="text-sm font-medium">
                  50% today, 50% on {fmtDate(ev.balance_due_on)}
                </div>
                <div className="mt-0.5 text-xs text-[#6B6B6B]">
                  {fmtMoney(calc.total / 2)} today. The remaining {fmtMoney(calc.total / 2)} is
                  automatically charged to the same card on {fmtDate(ev.balance_due_on)} — we'll
                  email you a reminder the week before.
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="mt-4 rounded-[4px] border border-[#E8E2D9] bg-white p-6">
        <SectionLabel>Your total</SectionLabel>
        <div className="mt-3 space-y-2 text-sm">
          <Row label={`${tier.section_name} · ${calc.nights} nights`} value={calc.base} />
          {calc.addonAmt > 0 && <Row label="Enhancements" value={calc.addonAmt} />}
          {calc.cotFee > 0 && <Row label="3rd guest / cot setup" value={calc.cotFee} />}
          {calc.resortFee > 0 && (
            <Row label={`Resort fee (${tier.resort_fee_percent}%)`} value={calc.resortFee} />
          )}
          <Row label="NY sales tax (est.)" value={calc.tax} muted />
          {isSplit && <Row label="Weekend total (incl. tax)" value={calc.total} muted />}
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-[#E8E2D9] pt-4">
          <span className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">Due today</span>
          <span className="font-serif text-2xl text-[#2C3E2D]">{fmtMoney(dueToday)}</span>
        </div>
        {isSplit && ev.balance_due_on && (
          <p className="mt-2 text-xs text-[#6B6B6B]">
            Remaining {fmtMoney(calc.total / 2)} auto-charged {fmtDate(ev.balance_due_on)}.
          </p>
        )}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 px-1 text-xs text-[#6B6B6B]">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#2C3E2D]"
        />
        <span>
          I understand the cancellation policy: {cancellationPolicy(ev)} We highly recommend travel
          insurance — typically 5–8% of your trip, about {fmtMoney(Math.round(calc.total * 0.05))}–
          {fmtMoney(Math.round(calc.total * 0.08))} for this reservation.
        </span>
      </label>

      <button
        onClick={reserve}
        disabled={submitting || !agreed}
        className="mt-4 w-full rounded bg-[#2C3E2D] px-4 py-3 min-h-[44px] text-sm uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#2C3E2D]/90 disabled:opacity-50"
      >
        {submitting ? "Opening secure checkout…" : "Reserve & pay"}
      </button>
      {error && <p className="mt-3 text-center text-sm text-[#6B6B6B]">{error}</p>}
      <p className="mt-3 text-center text-xs text-[#6B6B6B]">
        Payment is handled securely by Stripe.
      </p>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={muted ? "text-[#6B6B6B]" : "text-[#3A3A3A]"}>{label}</span>
      <span className={muted ? "text-[#6B6B6B]" : "text-[#1A1A1A]"}>{fmtMoney(value)}</span>
    </div>
  );
}

/* ───────────────────────── Confirmation ───────────────────────── */

function PopupConfirmation({
  eventSlug,
  payload,
}: {
  eventSlug: string;
  payload: PopupEventPayload | null;
}) {
  const fetchConfirmation = fetchSessionConfirmation;
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [booking, setBooking] = useState<
    Awaited<ReturnType<typeof fetchSessionConfirmation>>["bookings"][number] | null
  >(null);

  useEffect(() => {
    try {
      sessionStorage.removeItem(`gfh_popup_guest_${eventSlug}`);
    } catch {
      /* sessionStorage unavailable — non-fatal */
    }
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setLoading(false);
      setTimedOut(true);
      return;
    }
    let attempts = 0;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const { bookings } = await fetchConfirmation({ data: { sessionId } });
        const b = bookings?.[0];
        if (b && (b.payment_status === "paid" || b.payment_status === "deposit_paid")) {
          setBooking(b);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("popup confirmation poll failed", err);
      }
      attempts++;
      if (attempts >= 10) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  const tierIndex = payload?.tiers.findIndex((t) => t.id === booking?.section_id) ?? -1;
  const includedItems =
    payload && tierIndex >= 0
      ? payload.itinerary.filter((it) => {
          const flags = [it.tier1_included, it.tier2_included, it.tier3_included];
          return flags[tierIndex];
        })
      : [];

  return (
    <div className="min-h-dvh bg-[#FAF8F4] font-sans text-[#1A1A1A]">
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <Wordmark />
        {loading && (
          <p className="mt-20 text-center text-sm text-[#6B6B6B]">Confirming your reservation…</p>
        )}
        {!loading && (timedOut || !booking) && (
          <div className="mt-16 text-center">
            <h1 className="font-serif text-3xl font-medium md:text-4xl">
              Your payment was received.
            </h1>
            <p className="mt-3 text-sm text-[#6B6B6B]">
              Your confirmation is on its way — check your email shortly.
            </p>
          </div>
        )}
        {!loading && booking && (
          <div className="mx-auto mt-10 max-w-[600px]">
            <div className="rounded-[4px] border border-[#E8E2D9] bg-white p-6 sm:p-8 md:p-10">
              <SectionLabel>Confirmed</SectionLabel>
              <h1 className="mt-2 font-serif text-3xl">{booking.guest_name}, you're confirmed.</h1>
              {booking.event?.wedding_name && (
                <p className="mt-1 font-serif text-lg italic text-[#6B6B6B]">
                  {booking.event.wedding_name}
                </p>
              )}

              <div className="mt-6">
                <SectionLabel>Your stay</SectionLabel>
                <div className="mt-2 font-serif text-xl">{booking.section?.section_name}</div>
                <div className="mt-1 text-sm text-[#3A3A3A]">
                  {fmtDate(booking.event?.check_in_date)} → {fmtDate(booking.event?.check_out_date)}
                </div>
                <div className="mt-1 text-xs text-[#6B6B6B]">
                  Your room is assigned by the estate — arrival details land in your inbox before
                  the weekend.
                </div>
              </div>

              <div className="mt-6 border-t border-[#E8E2D9] pt-5 text-sm">
                <Row label="Package" value={Number(booking.base_amount) || 0} />
                {Number(booking.addon_amount) > 0 && (
                  <Row label="Enhancements" value={Number(booking.addon_amount)} />
                )}
                {Number(booking.resort_fee) > 0 && (
                  <Row label="Resort fee" value={Number(booking.resort_fee)} />
                )}
                <div className="mt-3 flex items-baseline justify-between border-t border-[#E8E2D9] pt-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">
                    {booking.payment_status === "deposit_paid"
                      ? "Weekend total (incl. tax)"
                      : "Paid (incl. tax)"}
                  </span>
                  <span className="font-serif text-xl text-[#2C3E2D]">
                    {fmtMoney(
                      (Number(booking.base_amount) || 0) +
                        (Number(booking.addon_amount) || 0) +
                        (Number(booking.resort_fee) || 0) +
                        (Number(booking.tax_amount) || 0) ||
                        Number(booking.total_amount) ||
                        0,
                    )}
                  </span>
                </div>
                {booking.payment_status === "deposit_paid" && (
                  <p className="mt-2 text-xs text-[#6B6B6B]">
                    You paid 50% today. The remaining balance is automatically charged to the same
                    card
                    {payload?.event?.balance_due_on
                      ? ` on ${fmtDate(payload.event.balance_due_on)}`
                      : " before the weekend"}{" "}
                    — we'll email you a reminder first.
                  </p>
                )}
              </div>

              {includedItems.length > 0 && (
                <div className="mt-6 border-t border-[#E8E2D9] pt-5">
                  <SectionLabel>Your weekend includes</SectionLabel>
                  <ul className="mt-2 space-y-1">
                    {includedItems.map((it) => (
                      <li key={it.id} className="flex gap-2 text-xs text-[#3A3A3A]">
                        <span className="text-[#C9A84C]">✓</span>
                        <span>
                          {it.time_label ? `${it.time_label} — ` : ""}
                          {it.activity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-6 text-xs text-[#6B6B6B]">{CONTACT_LINE}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
