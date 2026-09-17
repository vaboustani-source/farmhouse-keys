import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getPopupEvent,
  createPopupBookingFn,
  checkPopupWaitlist,
  checkPopupReferral,
  setPopupPaymentChoice,
  updatePopupBookingDetails,
  releasePopupHold,
  type PopupEventPayload,
  type PopupRateType,
  type PopupTier,
  type PopupItineraryItem,
} from "@/lib/popup.functions";
import { getSectionAddons, fetchSessionConfirmation } from "@/lib/booking.functions";
import { createCheckoutSession, checkSessionStatus } from "@/lib/checkout";
import { loadStripe } from "@stripe/stripe-js";
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
      <img
        src="/gf-wordmark-white.png"
        alt="Gilbertsville Farmhouse"
        className="mx-auto w-full max-w-[340px]"
      />
      <div className="mt-3 text-[10px] uppercase tracking-[0.24em] text-[#B8AFA6]">
        A private estate
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.24em] text-[#B8956A]">{children}</div>;
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

type Step = { kind: "landing" } | { kind: "book"; tier: PopupTier };

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
    <div className="min-h-dvh bg-[#1E1313] font-sans text-[#F6F1E8]">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <Wordmark />

        {banner && step.kind === "landing" && (
          <div className="mx-auto mt-6 max-w-xl rounded-md border border-[#F09B9C]/50 bg-[#F9EDED] p-4 text-center text-sm text-[#1E1313]">
            {banner}
          </div>
        )}

        {loading && <p className="mt-20 text-center text-sm text-[#B8AFA6]">Setting the table…</p>}

        {!loading && (!payload?.event || payload.event.status !== "active") && (
          <div className="mt-20 text-center">
            <h1 className="font-serif text-3xl font-medium md:text-4xl">
              This weekend isn't open for reservations.
            </h1>
            <p className="mt-3 text-sm text-[#B8AFA6]">{CONTACT_LINE}</p>
          </div>
        )}

        {!loading && payload?.event && payload.event.status === "active" && (
          <>
            {step.kind === "landing" && (
              <Landing
                payload={payload}
                onReserve={(tier) => {
                  setBanner(null);
                  setStep({ kind: "book", tier });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            )}
            {step.kind === "book" && (
              <BookStep
                eventSlug={eventSlug}
                payload={payload}
                tier={step.tier}
                onBack={() => setStep({ kind: "landing" })}
                onSoldOut={() => {
                  loadEvent();
                  setBanner("That tier just sold out — here's what's still available.");
                  setStep({ kind: "landing" });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
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
        <p className="mt-4 text-sm text-[#E8E0D4]">
          {fmtDate(ev.check_in_date)} → {fmtDate(ev.check_out_date)} · {ev.nights}{" "}
          {ev.nights === 1 ? "night" : "nights"} at the estate
        </p>
        {ev.hero_intro && (
          <p className="mx-auto mt-6 max-w-xl font-serif text-lg italic leading-relaxed text-[#B8AFA6]">
            {ev.hero_intro}
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href="#tiers"
            className="inline-block rounded bg-[#F09B9C] px-6 py-3 text-xs uppercase tracking-[0.16em] text-[#1E1313] transition-colors hover:bg-[#F09B9C]/85"
          >
            Choose your weekend
          </a>
          <a
            href={FULL_STORY_URL}
            className="text-xs text-[#B8AFA6] underline underline-offset-2 hover:text-[#F6F1E8]"
          >
            Read the full weekend, hour by hour →
          </a>
        </div>
      </div>

      {/* Sale banner — copy flips automatically once the original end date passes */}
      {phase === "public" && ev.sale_active && (
        <div className="mx-auto mt-10 max-w-xl rounded-md border border-[#F09B9C] bg-[#F09B9C] p-4 text-center text-sm text-[#1E1313]">
          <span className="font-medium uppercase tracking-[0.12em]">
            {ev.sale_extended ? "Sale extended" : "Labor Day Sale"}
          </span>
          <span className="mx-2">·</span>
          {ev.sale_extended
            ? "Sale pricing honored through Monday, September 14."
            : "Every tier marked down through Tuesday, September 8."}
        </div>
      )}

      {/* Two-room group offer */}
      {ev.group_offer && phase !== "preopen" && (
        <div className="mx-auto mt-10 max-w-xl rounded-md border border-[#B8956A]/60 bg-[#2A1C1C] p-4 text-center text-sm text-[#F6F1E8]">
          <span className="font-medium uppercase tracking-[0.12em] text-[#B8956A]">
            {ev.group_offer.name}
          </span>
          <span className="mx-2">·</span>
          Come with another couple. Reserve {ev.group_offer.rooms === 2 ? "two" : ev.group_offer.rooms}{" "}
          guesthouses together and both are {ev.group_offer.percent}% off.
        </div>
      )}

      {/* Booking-window notice */}
      {phase === "preopen" && ev.waitlist_opens_at && (
        <div className="mx-auto mt-10 max-w-xl rounded-md border border-[#F09B9C]/50 bg-[#F9EDED] p-4 text-center text-sm text-[#1E1313]">
          Booking opens {fmtDateTime(ev.waitlist_opens_at)} for waitlist members
          {ev.public_opens_at ? ` — and to everyone ${fmtDateTime(ev.public_opens_at)}` : ""}.
        </div>
      )}
      {phase === "waitlist_only" && (
        <div className="mx-auto mt-10 max-w-xl rounded-md border border-[#F09B9C]/50 bg-[#F9EDED] p-4 text-center text-sm text-[#1E1313]">
          Waitlist first access — book today with the email you joined with.
          {ev.public_opens_at ? ` Public booking opens ${fmtDateTime(ev.public_opens_at)}.` : ""}
        </div>
      )}

      {/* Tier cards */}
      <div id="tiers" className="mt-14 scroll-mt-8">
        <h2 className="text-center font-serif text-3xl">Choose your weekend</h2>
        <p className="mt-2 text-center text-sm text-[#B8AFA6]">
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
              featured={tier.is_featured}
              phase={phase}
              saleActive={ev.sale_active}
              onReserve={() => onReserve(tier)}
            />
          ))}
        </div>
      </div>

      <p className="mt-12 text-center text-xs text-[#B8AFA6]">{CONTACT_LINE}</p>
    </div>
  );
}

function TierCard({
  tier,
  itinerary,
  tierIndex,
  featured,
  phase,
  saleActive,
  onReserve,
}: {
  tier: PopupTier;
  itinerary: PopupItineraryItem[];
  tierIndex: number;
  featured: boolean;
  phase: "preopen" | "waitlist_only" | "public";
  saleActive: boolean;
  onReserve: () => void;
}) {
  const included = itinerary.filter((it) => {
    const flags = [it.tier1_included, it.tier2_included, it.tier3_included];
    return flags[tierIndex];
  });
  // day_number doubles as the comparison-table category on pop-up events.
  const CATEGORY_LABELS: Record<number, string> = {
    1: "The stay",
    2: "The dining",
    3: "The experience",
  };
  const groups = [...new Set(included.map((it) => it.day_number))]
    .sort((a, b) => a - b)
    .map((d) => ({
      label: CATEGORY_LABELS[d] ?? "",
      items: included.filter((it) => it.day_number === d),
    }))
    .filter((g) => g.items.length > 0);
  const soldOut = tier.remaining <= 0;
  const regular = tier.regular_package_price != null ? Number(tier.regular_package_price) : null;
  const promo = tier.promo_package_price != null ? Number(tier.promo_package_price) : null;
  const sale = tier.sale_package_price != null ? Number(tier.sale_package_price) : null;
  const hasWaitlistRate = promo != null && regular != null && promo < regular;
  // Before public opening, only waitlist members can book — show their rate.
  // Once public, selling_price is server-computed (sale price during the sale
  // window, regular after); a matched waitlist/past-couples email still gets
  // the lower insider rate, verified at checkout.
  const headline = phase === "public" ? tier.selling_price : (promo ?? tier.selling_price);
  const showSaleStrike =
    phase === "public" && saleActive && sale != null && regular != null && sale < regular;
  // Remaining counts against the displayed stock (display_stock_start),
  // while the real total_rooms cap prevents overbooking server-side.
  const showScarcity = tier.show_scarcity;

  return (
    <div
      className={`relative flex flex-col rounded-[4px] border bg-[#2A1C1C] p-6 ${
        featured ? "border-[#F09B9C]" : "border-[#4A3737]"
      } ${soldOut ? "opacity-70" : ""}`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F09B9C] px-3 py-0.5 text-[10px] uppercase tracking-wider text-[#1E1313]">
          Most popular
        </div>
      )}
      <h3 className="font-serif text-2xl leading-snug">{tier.section_name}</h3>
      {tier.tagline && <p className="mt-1 text-xs italic text-[#B8AFA6]">{tier.tagline}</p>}

      <div className="mt-4 flex-1 space-y-4">
        {groups.map((g) => (
          <div key={g.label}>
            {g.label && (
              <div className="mb-1.5 font-serif text-sm italic text-[#F09B9C]">{g.label}</div>
            )}
            <ul className="space-y-1.5">
              {g.items.map((it) => (
                <li key={it.id} className="flex gap-2 text-xs text-[#E8E0D4]">
                  <span className="text-[#F09B9C]">✓</span>
                  <span>
                    {it.activity}
                    {it.note ? <span className="italic text-[#B8AFA6]"> — {it.note}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-[#4A3737] pt-4">
        {phase !== "public" && hasWaitlistRate && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#B8AFA6] line-through">{fmtMoney(regular!)}</span>
            <span className="rounded-full bg-[#F9EDED] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#1E1313]">
              Waitlist rate
            </span>
          </div>
        )}
        {showSaleStrike && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#B8AFA6] line-through">{fmtMoney(regular!)}</span>
            <span className="rounded-full bg-[#F09B9C] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#1E1313]">
              Sale
            </span>
          </div>
        )}
        <div className="font-serif text-3xl text-[#F6F1E8]">{fmtMoney(headline)}</div>
        <div className="text-xs text-[#B8AFA6]">
          per couple · {tier.nights} {tier.nights === 1 ? "night" : "nights"} · before fees &amp;
          tax
        </div>
        {phase === "public" && hasWaitlistRate && (
          <div className="mt-1 text-xs text-[#B8956A]">
            Waitlist &amp; past couples: {fmtMoney(promo!)} — honored at checkout.
          </div>
        )}
        {showScarcity && (
          <div className="mt-2 text-xs text-[#B8AFA6]">
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
          className="mt-4 w-full rounded bg-[#F09B9C] px-4 py-3 text-xs uppercase tracking-[0.16em] text-[#1E1313] transition-colors hover:bg-[#F09B9C]/85 disabled:cursor-not-allowed disabled:opacity-40"
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

/* ───────────────────────── Step 2: details + payment on one page ───────────────────────── */

type Hold = {
  bookingId: string;
  guestEmail: string;
  /** Covers every room on the hold (two for a group booking). */
  baseAmount: number;
  perRoomAmount: number;
  roomCount: number;
  /** The validated invitation code this hold was made with ("" = none). */
  refCode: string;
  rateType: PopupRateType;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** How long the on-page hold lasts before the room is released (Victoria: 3 min). */
const HOLD_SECONDS = 3 * 60;

const fmtCountdown = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

// "klarna" is a presentation choice only — it books as "full" and the guest
// picks Klarna on the Stripe payment screen.
type PaySchedule = "full" | "deposit_50_balance_50" | "klarna";

function computeTotals(
  tier: PopupTier,
  baseAmount: number,
  addons: Addon[],
  selectedIds: string[],
) {
  const nights = tier.nights || 2;
  const base = baseAmount;
  const addonAmt = addons
    .filter((a) => selectedIds.includes(a.id))
    .reduce(
      (sum, a) => sum + Number(a.addon_price) * (a.addon_type === "per_night" ? nights : 1),
      0,
    );
  const subtotal = base + addonAmt;
  const resortFee = (subtotal * Number(tier.resort_fee_percent || 0)) / 100;
  const tax = (subtotal + resortFee) * 0.08;
  const total = subtotal + resortFee + tax;
  return { nights, base, addonAmt, resortFee, tax, total };
}

/** "How would you like to pay?" — shown first, before the guest types anything. */
function PaymentOptions({
  ev,
  schedule,
  onChange,
  total,
}: {
  ev: NonNullable<PopupEventPayload["event"]>;
  schedule: PaySchedule;
  onChange: (s: PaySchedule) => void;
  total: number;
}) {
  const isSplit = schedule === "deposit_50_balance_50";
  return (
    <div className="mt-4 rounded-[4px] border border-[#4A3737] bg-[#2A1C1C] p-6">
      <h2 className="font-serif text-xl">How would you like to pay?</h2>
      <div className="mt-4 space-y-2">
        <label
          className={`flex cursor-pointer items-start gap-3 rounded border p-4 transition-colors ${
            schedule === "full" ? "border-[#F09B9C] bg-[#3A2626]" : "border-[#4A3737]"
          }`}
        >
          <input
            type="radio"
            name="paymentSchedule"
            checked={schedule === "full"}
            onChange={() => onChange("full")}
            className="mt-1 h-4 w-4 accent-[#F09B9C]"
          />
          <div>
            <div className="text-sm font-medium">Pay in full today</div>
            <div className="mt-0.5 text-xs text-[#B8AFA6]">
              {fmtMoney(total)} — done and dusted.
            </div>
          </div>
        </label>
        <label
          className={`flex cursor-pointer items-start gap-3 rounded border p-4 transition-colors ${
            schedule === "klarna" ? "border-[#F09B9C] bg-[#3A2626]" : "border-[#4A3737]"
          }`}
        >
          <input
            type="radio"
            name="paymentSchedule"
            checked={schedule === "klarna"}
            onChange={() => onChange("klarna")}
            className="mt-1 h-4 w-4 accent-[#F09B9C]"
          />
          <div>
            <div className="text-sm font-medium">Pay over time with Klarna</div>
            <div className="mt-0.5 text-xs text-[#B8AFA6]">
              Book today, pay in installments — from 4 interest-free payments to monthly plans.
              Select Klarna on the payment screen and choose the plan that fits.
            </div>
          </div>
        </label>
        {ev.split_available && ev.balance_due_on && (
          <label
            className={`flex cursor-pointer items-start gap-3 rounded border p-4 transition-colors ${
              isSplit ? "border-[#F09B9C] bg-[#3A2626]" : "border-[#4A3737]"
            }`}
          >
            <input
              type="radio"
              name="paymentSchedule"
              checked={isSplit}
              onChange={() => onChange("deposit_50_balance_50")}
              className="mt-1 h-4 w-4 accent-[#F09B9C]"
            />
            <div>
              <div className="text-sm font-medium">
                50% today, 50% on {fmtDate(ev.balance_due_on)}
              </div>
              <div className="mt-0.5 text-xs text-[#B8AFA6]">
                {fmtMoney(total / 2)} today. The remaining {fmtMoney(total / 2)} is automatically
                charged to the same card on {fmtDate(ev.balance_due_on)} — we'll email you a
                reminder the week before.
              </div>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}

function BookStep({
  eventSlug,
  payload,
  tier,
  onBack,
  onSoldOut,
}: {
  eventSlug: string;
  payload: PopupEventPayload;
  tier: PopupTier;
  onBack: () => void;
  onSoldOut: () => void;
}) {
  const createBooking = createPopupBookingFn;
  const fetchAddons = getSectionAddons;
  const ev = payload.event!;
  // Payment choice + add-ons live here so "How would you like to pay?" can
  // sit above the details form, before a hold exists.
  const [schedule, setSchedule] = useState<PaySchedule>("full");
  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [name2, setName2] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrZip, setAddrZip] = useState("");
  const [onWaitlist, setOnWaitlist] = useState(false);
  // Two-room group offer ("The Quartet"): one reservation, two guesthouses.
  const offer = ev.group_offer ?? null;
  const offerAvailable =
    !!offer && ev.phase !== "preopen" && (tier.rooms_available ?? tier.remaining) >= offer.rooms;
  const [twoRooms, setTwoRooms] = useState(false);
  const [r2name1, setR2name1] = useState("");
  const [r2name2, setR2name2] = useState("");
  const wantTwo = twoRooms && offerAvailable;
  // Friend's invitation code — prefilled from an invite link (?ref=CODE).
  const [refInput, setRefInput] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("ref");
      return (fromUrl ?? sessionStorage.getItem(`gfh_popup_ref_${eventSlug}`) ?? "").toUpperCase();
    } catch {
      return "";
    }
  });
  const [refCheck, setRefCheck] = useState<{
    code: string;
    valid: boolean;
    firstName: string | null;
  } | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [holdState, setHoldState] = useState<"idle" | "holding" | "ready" | "expired" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  // Countdown shown beside "Your room is held for you." — when it runs out
  // the hold is released for real and the guest can re-hold with one click.
  const [holdDeadline, setHoldDeadline] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);
  const [reholdTick, setReholdTick] = useState(0);
  const holdRef = useRef<Hold | null>(null);
  const holdSeq = useRef(0);

  useEffect(() => {
    fetchAddons({ data: { sectionId: tier.id } }).then(({ addons }) => {
      setAddons(addons);
      setSelectedIds(addons.filter((a) => a.is_required).map((a) => a.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier.id]);

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
          twoRooms?: boolean;
          r2name1?: string;
          r2name2?: string;
        };
        if (g.twoRooms) setTwoRooms(true);
        if (g.r2name1) setR2name1(g.r2name1);
        if (g.r2name2) setR2name2(g.r2name2);
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
    if (!EMAIL_RE.test(candidate)) {
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

  // Live invitation-code check (display only — the server re-resolves it).
  useEffect(() => {
    const candidate = refInput.trim().toUpperCase();
    if (!ev.referral || candidate.length < 5) {
      setRefCheck(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      checkPopupReferral({ data: { eventSlug, code: candidate } }).then((r) => {
        if (cancelled) return;
        setRefCheck({ code: candidate, valid: r.valid, firstName: r.firstName });
        if (r.valid) {
          try {
            sessionStorage.setItem(`gfh_popup_ref_${eventSlug}`, candidate);
          } catch {
            /* sessionStorage unavailable — non-fatal */
          }
        }
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [refInput, eventSlug, !!ev.referral]);
  const validRef =
    refCheck?.valid && refCheck.code === refInput.trim().toUpperCase() ? refCheck.code : "";

  const complete =
    (!wantTwo || (!!r2name1.trim() && !!r2name2.trim())) &&
    !!name.trim() &&
    !!name2.trim() &&
    EMAIL_RE.test(email.trim()) &&
    !!phone.trim() &&
    !!addr1.trim() &&
    !!addrCity.trim() &&
    !!addrState.trim() &&
    !!addrZip.trim();

  // One-page flow: the moment the details are complete, hold the room and
  // let the payment section mount beneath the form — no Continue button.
  // Later edits update the hold in place; only a new email needs a new hold
  // (Stripe's session is tied to the email), and the old one is released.
  useEffect(() => {
    if (!complete) return;
    const seq = ++holdSeq.current;
    const timer = setTimeout(async () => {
      const details = {
        guestName: name.trim(),
        guest2Name: name2.trim() || undefined,
        guestPhone: phone.trim(),
        addressLine1: addr1.trim(),
        addressCity: addrCity.trim(),
        addressState: addrState.trim(),
        addressZip: addrZip.trim(),
        room2Guest1Name: wantTwo ? r2name1.trim() : undefined,
        room2Guest2Name: wantTwo ? r2name2.trim() : undefined,
      };
      const wantRooms = wantTwo && offer ? offer.rooms : 1;
      const normalizedEmail = email.trim().toLowerCase();
      try {
        sessionStorage.setItem(
          `gfh_popup_guest_${eventSlug}`,
          JSON.stringify({
            name,
            name2,
            email,
            phone,
            addr1,
            addrCity,
            addrState,
            addrZip,
            twoRooms,
            r2name1,
            r2name2,
          }),
        );
      } catch {
        /* sessionStorage unavailable — non-fatal */
      }
      const current = holdRef.current;
      try {
        // Same email, same room count, same invitation code: just update the
        // details. Anything that changes the price or the referral re-holds
        // (the server updates the pending booking in place).
        if (
          current &&
          current.guestEmail === normalizedEmail &&
          current.roomCount === wantRooms &&
          current.refCode === validRef
        ) {
          const r = await updatePopupBookingDetails({
            data: { bookingId: current.bookingId, ...details },
          });
          if (!r.ok) throw new Error("details update failed");
          return;
        }
        setHoldState("holding");
        setError(null);
        const res = await createBooking({
          data: {
            eventSlug,
            sectionId: tier.id,
            guestEmail: email.trim(),
            ...details,
            roomCount: wantRooms,
            referralCode: validRef || undefined,
          },
        });
        if (seq !== holdSeq.current) return;
        if (!res.ok) {
          if (res.reason === "sold_out") {
            onSoldOut();
            return;
          }
          if (res.reason === "already_booked") {
            setError(
              "You already have a reservation for this weekend — check your email for the confirmation, or reach out and we'll help.",
            );
          } else if (res.reason === "waitlist_only") {
            setError(
              `Right now booking is reserved for our waitlist — use the email you joined the waitlist with${
                ev.public_opens_at
                  ? `, or come back ${fmtDateTime(ev.public_opens_at)} when booking opens to everyone`
                  : ""
              }.`,
            );
          } else if (res.reason === "not_open") {
            setError(
              ev.waitlist_opens_at
                ? `Booking hasn't opened yet — waitlist members can book starting ${fmtDateTime(ev.waitlist_opens_at)}.`
                : "Booking hasn't opened yet.",
            );
          } else {
            setError("Something went wrong — please check your details and try again.");
          }
          setHoldState("error");
          return;
        }
        if (current && current.bookingId !== res.booking.id) {
          releasePopupHold({ data: { bookingId: current.bookingId } });
        }
        const next: Hold = {
          bookingId: res.booking.id,
          guestEmail: normalizedEmail,
          baseAmount: res.booking.base_amount,
          perRoomAmount: res.booking.per_room_amount,
          roomCount: res.booking.room_count,
          refCode: validRef,
          rateType: res.booking.rate_type,
        };
        holdRef.current = next;
        setHold(next);
        setHoldDeadline(Date.now() + HOLD_SECONDS * 1000);
        setSecondsLeft(HOLD_SECONDS);
        setHoldState("ready");
      } catch (err) {
        console.error("popup hold failed", err);
        if (seq === holdSeq.current) {
          setError("Something went wrong — please check your details and try again.");
          setHoldState("error");
        }
      }
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    complete,
    name,
    name2,
    email,
    phone,
    addr1,
    addrCity,
    addrState,
    addrZip,
    eventSlug,
    tier.id,
    reholdTick,
    wantTwo,
    r2name1,
    r2name2,
    validRef,
  ]);

  // Tick the countdown once a second; at zero release the hold server-side,
  // drop the payment form, and offer a one-click re-hold.
  useEffect(() => {
    if (holdState !== "ready" || holdDeadline == null) return;
    const tick = () => {
      const left = Math.ceil((holdDeadline - Date.now()) / 1000);
      setSecondsLeft(left);
      if (left <= 0) {
        const current = holdRef.current;
        holdRef.current = null;
        if (current) releasePopupHold({ data: { bookingId: current.bookingId } });
        setHold(null);
        setHoldState("expired");
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdState, holdDeadline]);

  const regular = tier.regular_package_price != null ? Number(tier.regular_package_price) : null;
  const promo = tier.promo_package_price != null ? Number(tier.promo_package_price) : null;
  // Once the room is held, show the server-stamped price; before that,
  // selling_price is server-computed (sale price while the sale runs).
  const ownPrice = onWaitlist
    ? (promo ?? tier.selling_price)
    : ev.phase === "public"
      ? tier.selling_price
      : (promo ?? tier.selling_price);
  // An invited couple gets X% off the regular price — never stacked, the best
  // single rate wins (mirrors create_popup_booking).
  const friendPercent = Number(ev.referral?.friend_percent) || 0;
  const invitedPrice =
    validRef && friendPercent > 0 && regular != null
      ? Math.round(regular * (1 - friendPercent / 100) * 100) / 100
      : null;
  const singlePrice = invitedPrice != null && invitedPrice < ownPrice ? invitedPrice : ownPrice;
  // Group offer: X% off the regular price on every room, never more than the
  // guest's own rate (mirrors create_popup_booking).
  const groupPerRoom =
    offer && regular != null
      ? Math.min(singlePrice, Math.round(regular * (1 - offer.percent / 100) * 100) / 100)
      : singlePrice;
  const holdMatches = !!hold && hold.roomCount === (wantTwo && offer ? offer.rooms : 1);
  // Per couple, for the header line.
  const displayPrice = holdMatches ? hold!.perRoomAmount : wantTwo ? groupPerRoom : singlePrice;
  // Everything on the reservation, for the totals.
  const baseForTotals = holdMatches
    ? hold!.baseAmount
    : wantTwo && offer
      ? groupPerRoom * offer.rooms
      : singlePrice;

  // Estimated until the room is held; then the server-stamped price.
  const totals = useMemo(
    () => computeTotals(tier, baseForTotals, addons, selectedIds),
    [tier, baseForTotals, addons, selectedIds],
  );

  const inputCls =
    "w-full rounded border border-[#4A3737] bg-[#2A1C1C] px-4 py-3 text-base focus:border-[#F09B9C] focus:outline-none";

  return (
    <div className="mx-auto mt-10 max-w-md">
      <button
        onClick={onBack}
        className="mb-6 inline-flex min-h-[44px] items-center -ml-1 px-2 py-2 text-xs uppercase tracking-[0.16em] text-[#B8AFA6] hover:text-[#F6F1E8]"
      >
        ← Compare all packages
      </button>

      <div className="rounded-[4px] border border-[#4A3737] bg-[#2A1C1C] p-6">
        <SectionLabel>Your weekend</SectionLabel>
        <div className="mt-1 font-serif text-2xl">{tier.section_name}</div>
        <div className="mt-1 text-sm text-[#B8AFA6]">
          {fmtDate(ev.check_in_date)} → {fmtDate(ev.check_out_date)} · {fmtMoney(displayPrice)} per
          couple
          {regular != null && displayPrice < regular && (
            <span className="ml-2 text-[#B8AFA6] line-through">{fmtMoney(regular!)}</span>
          )}
        </div>
        {wantTwo && offer && (
          <div className="mt-2 text-xs text-[#B8956A]">
            ✓ {offer.name} — two guesthouses, {offer.percent}% off both.
          </div>
        )}
        {onWaitlist && (
          <div className="mt-2 text-xs text-[#B8956A]">
            ✓ We recognize this email — your private rate is locked in.
          </div>
        )}
        {hold?.rateType === "sale" && !onWaitlist && (
          <div className="mt-2 text-xs text-[#B8956A]">
            ✓ Sale price applied — {fmtMoney(hold.baseAmount)} per couple.
          </div>
        )}
      </div>

      {offer && offerAvailable && (
        <label
          className={`mt-4 flex cursor-pointer items-start gap-3 rounded-[4px] border bg-[#2A1C1C] p-5 transition-colors ${
            wantTwo ? "border-[#B8956A]" : "border-[#4A3737] hover:border-[#B8956A]/60"
          }`}
        >
          <input
            type="checkbox"
            checked={twoRooms}
            onChange={(e) => setTwoRooms(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#B8956A]"
          />
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-[#B8956A]">{offer.name}</div>
            <div className="mt-1 font-serif text-lg">
              Coming with another couple? {offer.percent}% off both guesthouses.
            </div>
            <div className="mt-1 text-xs text-[#B8AFA6]">
              Two private guesthouses on one reservation — {fmtMoney(groupPerRoom)} per couple
              {regular != null && groupPerRoom < regular ? ` instead of ${fmtMoney(regular)}` : ""}.
            </div>
          </div>
        </label>
      )}

      <PaymentOptions ev={ev} schedule={schedule} onChange={setSchedule} total={totals.total} />

      <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-3">
        <SectionLabel>Your details</SectionLabel>
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
        {wantTwo && (
          <>
            <input
              type="text"
              required
              value={r2name1}
              onChange={(e) => setR2name1(e.target.value)}
              placeholder="Second guesthouse — guest 1 full name"
              className={inputCls}
            />
            <input
              type="text"
              required
              value={r2name2}
              onChange={(e) => setR2name2(e.target.value)}
              placeholder="Second guesthouse — guest 2 full name"
              className={inputCls}
            />
          </>
        )}
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
        {ev.referral ? (
          <div>
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value.toUpperCase())}
              placeholder="Invited by a couple? Their code (optional)"
              className={inputCls}
            />
            {validRef && (
              <div className="mt-2 text-xs text-[#B8956A]">
                ✓ {refCheck?.firstName ?? "Your friends"} invited you
                {friendPercent > 0 && !wantTwo
                  ? ` — ${friendPercent}% off your weekend is applied.`
                  : " — we'll thank them for it."}
              </div>
            )}
            {refCheck && !refCheck.valid && refCheck.code === refInput.trim().toUpperCase() && (
              <div className="mt-2 text-xs text-[#B8AFA6]">
                We don't recognize that code. You can still reserve without it.
              </div>
            )}
          </div>
        ) : null}
      </form>

      {holdState === "expired" && (
        <div className="mt-6 rounded-[4px] border border-[#F09B9C]/50 bg-[#2A1C1C] p-5 text-center">
          <p className="text-sm text-[#F6F1E8]">
            Your hold ran out and the {wantTwo ? "rooms were" : "room was"} released.
          </p>
          <p className="mt-1 text-xs text-[#B8AFA6]">
            Still here? Hold it again and you'll have another {fmtCountdown(HOLD_SECONDS)} to
            complete payment.
          </p>
          <button
            type="button"
            onClick={() => setReholdTick((n) => n + 1)}
            className="mt-3 rounded bg-[#F09B9C] px-6 py-3 min-h-[44px] text-xs uppercase tracking-[0.16em] text-[#1E1313] transition-colors hover:bg-[#F09B9C]/85"
          >
            Hold my room again
          </button>
        </div>
      )}

      {holdState !== "ready" && holdState !== "expired" && (
        <p className="mt-4 text-center text-xs text-[#B8AFA6]">
          {holdState === "holding"
            ? "Holding your room…"
            : holdState === "error"
              ? error
              : "Once your details are in, payment appears right here — nothing is charged until you confirm."}
        </p>
      )}

      {hold && holdState === "ready" && (
        <p className="mt-6 text-center text-sm italic text-[#F09B9C]">
          {hold.roomCount > 1 ? "Your rooms are held for you." : "Your room is held for you."}{" "}
          <span
            className={`not-italic tabular-nums ${secondsLeft <= 30 ? "text-[#F6F1E8]" : "text-[#B8AFA6]"}`}
          >
            {fmtCountdown(secondsLeft)} to complete payment
          </span>
        </p>
      )}

      {hold && holdState === "ready" && (
        <ReviewErrorBoundary
          onError={(err) => {
            console.error("Popup payment section crashed", err);
            setHoldState("error");
            setError("Something went wrong — please refresh and try again.");
          }}
        >
          <PaymentSection
            eventSlug={eventSlug}
            payload={payload}
            tier={tier}
            bookingId={hold.bookingId}
            baseAmount={hold.baseAmount}
            rateType={hold.rateType}
            roomCount={hold.roomCount}
            schedule={schedule}
            addons={addons}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
          />
        </ReviewErrorBoundary>
      )}
    </div>
  );
}

/* ───────────────────────── Add-ons + pay options + embedded Stripe ───────────────────────── */

function PaymentSection({
  eventSlug,
  payload,
  tier,
  bookingId,
  baseAmount,
  rateType,
  roomCount,
  schedule,
  addons,
  selectedIds,
  setSelectedIds,
}: {
  eventSlug: string;
  payload: PopupEventPayload;
  tier: PopupTier;
  bookingId: string;
  baseAmount: number;
  rateType: PopupRateType;
  roomCount: number;
  schedule: PaySchedule;
  addons: Addon[];
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const ev = payload.event!;

  const [payState, setPayState] = useState<"preparing" | "ready" | "failed">("preparing");
  const [error, setError] = useState<string | null>(null);
  const checkoutRef = useRef<{ destroy: () => void } | null>(null);
  const requestSeq = useRef(0);
  const icFired = useRef(false);

  const calc = useMemo(
    () => computeTotals(tier, baseAmount, addons, selectedIds),
    [tier, addons, selectedIds, baseAmount],
  );

  const isSplit = schedule === "deposit_50_balance_50";
  const dueToday = isSplit ? calc.total / 2 : calc.total;
  // A group booking covers several rooms: compare against regular × rooms.
  const regularPrice =
    tier.regular_package_price != null ? Number(tier.regular_package_price) * roomCount : null;
  const rateDiscount =
    (rateType === "waitlist" ||
      rateType === "sale" ||
      rateType === "group" ||
      rateType === "referral") &&
    regularPrice != null &&
    regularPrice > calc.base
      ? regularPrice - calc.base
      : 0;
  const discountLabel =
    rateType === "group"
      ? `${ev.group_offer?.name ?? "Two-room rate"} · ${ev.group_offer?.percent ?? 0}% off`
      : rateType === "referral"
        ? `Invitation rate · ${Number(ev.referral?.friend_percent) || 0}% off`
        : rateType === "sale"
          ? "Sale discount"
          : "Waitlist discount";
  const stayLabel = `${roomCount > 1 ? `${roomCount} guesthouses · ` : ""}${tier.section_name} · ${calc.nights} nights`;

  // The payment form mounts as soon as the hold exists and rebuilds
  // (debounced) whenever the booking, add-ons or payment schedule change,
  // since all alter the session. Failures offer a hosted redirect.
  useEffect(() => {
    const seq = ++requestSeq.current;
    setPayState("preparing");
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const effectiveSchedule = schedule === "klarna" ? "full" : schedule;
        const choice = await setPopupPaymentChoice({
          data: { bookingId, schedule: effectiveSchedule },
        });
        if (!choice.ok) throw new Error("payment choice not saved");
        const { clientSecret, alreadyPaid, redirectUrl, locked, publishableKey } =
          await createCheckoutSession({
            bookingId,
            addonIds: selectedIds.filter((id) => !addons.find((a) => a.id === id)?.is_required),
            eventSlug,
            sectionSlug: tier.booking_link_slug ?? tier.id,
            cotRequested: false,
            returnPath: `/stay/${eventSlug}`,
            uiMode: "embedded",
            forceNew: true,
          });
        if (seq !== requestSeq.current) return;
        if (alreadyPaid && redirectUrl) {
          window.location.href = redirectUrl;
          return;
        }
        if (locked || !clientSecret) throw new Error(locked ? "locked" : "no client secret");
        // Build-time key first; otherwise the edge function's STRIPE_PUBLISHABLE_KEY.
        const pk =
          (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ||
          publishableKey ||
          undefined;
        if (!pk) {
          throw new Error(
            "Stripe publishable key missing — set VITE_STRIPE_PUBLISHABLE_KEY in .env or STRIPE_PUBLISHABLE_KEY in the edge function secrets",
          );
        }
        const stripe = await loadStripe(pk);
        if (!stripe) throw new Error("stripe.js failed to load");
        const checkout = await stripe.createEmbeddedCheckoutPage({ clientSecret });
        if (seq !== requestSeq.current) {
          checkout.destroy();
          return;
        }
        checkoutRef.current?.destroy();
        checkoutRef.current = checkout;
        checkout.mount("#embedded-checkout");
        if (!icFired.current) {
          icFired.current = true;
          window.fbq?.("track", "InitiateCheckout", { content_name: eventSlug });
        }
        setPayState("ready");
      } catch (err) {
        console.error("embedded checkout setup failed", err);
        if (seq === requestSeq.current) setPayState("failed");
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, schedule, selectedIds, addons, baseAmount]);

  // Tear down the payment iframe when leaving the page.
  useEffect(() => () => checkoutRef.current?.destroy(), []);

  // Escape hatch when the embed can't load: classic hosted redirect.
  const openHostedCheckout = async () => {
    setError(null);
    try {
      const { url } = await createCheckoutSession({
        bookingId,
        addonIds: selectedIds.filter((id) => !addons.find((a) => a.id === id)?.is_required),
        eventSlug,
        sectionSlug: tier.booking_link_slug ?? tier.id,
        cotRequested: false,
        returnPath: `/stay/${eventSlug}`,
        forceNew: true,
      });
      if (url) window.location.href = url;
      else setError("We couldn't open checkout — please try again.");
    } catch (err) {
      console.error("hosted checkout failed", err);
      setError("We couldn't open checkout — please try again.");
    }
  };

  return (
    <div className="mt-2">
      {addons.length > 0 && (
        <div className="mt-4 rounded-[4px] border border-[#4A3737] bg-[#2A1C1C] p-6">
          <h2 className="font-serif text-xl">Enhance your stay</h2>
          <div className="mt-4 space-y-2">
            {addons.map((a) => {
              const checked = selectedIds.includes(a.id);
              const disabled = a.is_required;
              return (
                <label
                  key={a.id}
                  className={`flex cursor-pointer items-start justify-between gap-4 rounded border p-4 transition-colors ${
                    checked ? "border-[#F09B9C] bg-[#3A2626]" : "border-[#4A3737]"
                  } ${disabled ? "cursor-default opacity-90" : ""}`}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {a.addon_name}
                      {a.is_required && (
                        <span className="ml-2 rounded-full bg-[#F9EDED] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#1E1313]">
                          Included
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-[#B8AFA6]">
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
                    className="mt-1 h-5 w-5 accent-[#F09B9C]"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="mt-4 rounded-[4px] border border-[#4A3737] bg-[#2A1C1C] p-6">
        <SectionLabel>Your total</SectionLabel>
        <div className="mt-3 space-y-2 text-sm">
          {rateDiscount > 0 && regularPrice != null ? (
            <>
              <Row label={stayLabel} value={regularPrice} />
              <Row label={discountLabel} value={-rateDiscount} />
            </>
          ) : (
            <Row label={stayLabel} value={calc.base} />
          )}
          {calc.addonAmt > 0 && <Row label="Enhancements" value={calc.addonAmt} />}
          {calc.resortFee > 0 && (
            <Row label={`Resort fee (${tier.resort_fee_percent}%)`} value={calc.resortFee} />
          )}
          <Row label="NY sales tax (est.)" value={calc.tax} muted />
          {isSplit && <Row label="Weekend total (incl. tax)" value={calc.total} muted />}
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-[#4A3737] pt-4">
          <span className="text-xs uppercase tracking-[0.16em] text-[#B8AFA6]">Due today</span>
          <span className="font-serif text-2xl text-[#F6F1E8]">{fmtMoney(dueToday)}</span>
        </div>
        {isSplit && ev.balance_due_on && (
          <p className="mt-2 text-xs text-[#B8AFA6]">
            Remaining {fmtMoney(calc.total / 2)} auto-charged {fmtDate(ev.balance_due_on)}.
          </p>
        )}
      </div>

      <p className="mt-4 px-1 text-xs text-[#B8AFA6]">
        {cancellationPolicy(ev)} We highly recommend travel insurance — typically 5–8% of your trip,
        about {fmtMoney(Math.round(calc.total * 0.05))}–{fmtMoney(Math.round(calc.total * 0.08))}{" "}
        for this reservation.
      </p>

      {/* Payment — mounted in place so paying takes zero extra clicks */}
      <div className="mt-4">
        {payState === "preparing" && (
          <p className="py-6 text-center text-sm text-[#B8AFA6]">Preparing secure payment…</p>
        )}
        {payState === "failed" && (
          <div className="py-4 text-center">
            <p className="text-sm text-[#B8AFA6]">
              Enter your card details on Stripe's secure checkout page — it takes about a minute.
            </p>
            <button
              onClick={openHostedCheckout}
              className="mt-3 rounded bg-[#F09B9C] px-6 py-3 min-h-[44px] text-sm uppercase tracking-[0.16em] text-[#1E1313] transition-colors hover:bg-[#F09B9C]/85"
            >
              Continue to secure checkout
            </button>
          </div>
        )}
        <div className={payState === "ready" ? "overflow-hidden rounded-[4px] bg-white" : ""}>
          <div id="embedded-checkout" />
        </div>
      </div>
      {error && <p className="mt-3 text-center text-sm text-[#B8AFA6]">{error}</p>}
      <p className="mt-3 text-center text-xs text-[#B8AFA6]">
        Payment is handled securely by Stripe.
      </p>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={muted ? "text-[#B8AFA6]" : "text-[#E8E0D4]"}>{label}</span>
      <span className={muted ? "text-[#B8AFA6]" : "text-[#F6F1E8]"}>{fmtMoney(value)}</span>
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
  const [copied, setCopied] = useState(false);
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
          // Dedupe on session_id — the success URL survives refreshes and revisits.
          try {
            const pixelKey = `gfh_pixel_purchase_${sessionId}`;
            if (!localStorage.getItem(pixelKey)) {
              localStorage.setItem(pixelKey, "1");
              window.fbq?.("track", "Purchase", {
                value: b.total_amount ?? 0,
                currency: "USD",
                content_name: eventSlug,
              });
            }
          } catch {
            window.fbq?.("track", "Purchase", {
              value: b.total_amount ?? 0,
              currency: "USD",
              content_name: eventSlug,
            });
          }
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
    <div className="min-h-dvh bg-[#1E1313] font-sans text-[#F6F1E8]">
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <Wordmark />
        {loading && (
          <p className="mt-20 text-center text-sm text-[#B8AFA6]">Confirming your reservation…</p>
        )}
        {!loading && (timedOut || !booking) && (
          <div className="mt-16 text-center">
            <h1 className="font-serif text-3xl font-medium md:text-4xl">
              Your payment was received.
            </h1>
            <p className="mt-3 text-sm text-[#B8AFA6]">
              Your confirmation is on its way — check your email shortly.
            </p>
          </div>
        )}
        {!loading && booking && (
          <div className="mx-auto mt-10 max-w-[600px]">
            <div className="rounded-[4px] border border-[#4A3737] bg-[#2A1C1C] p-6 sm:p-8 md:p-10">
              <SectionLabel>Confirmed</SectionLabel>
              <h1 className="mt-2 font-serif text-3xl">{booking.guest_name}, you're confirmed.</h1>
              {booking.event?.wedding_name && (
                <p className="mt-1 font-serif text-lg italic text-[#B8AFA6]">
                  {booking.event.wedding_name}
                </p>
              )}

              <div className="mt-6">
                <SectionLabel>Your stay</SectionLabel>
                <div className="mt-2 font-serif text-xl">
                  {(booking.room_count ?? 1) > 1 ? `${booking.room_count} guesthouses · ` : ""}
                  {booking.section?.section_name}
                </div>
                <div className="mt-1 text-sm text-[#E8E0D4]">
                  {fmtDate(booking.event?.check_in_date)} → {fmtDate(booking.event?.check_out_date)}
                </div>
                {(booking.room_count ?? 1) > 1 && booking.room2_guest1_name && (
                  <div className="mt-1 text-sm text-[#E8E0D4]">
                    With {booking.room2_guest1_name}
                    {booking.room2_guest2_name ? ` & ${booking.room2_guest2_name}` : ""} in the
                    second guesthouse
                  </div>
                )}
                <div className="mt-1 text-xs text-[#B8AFA6]">
                  Your room is assigned by the estate — arrival details land in your inbox before
                  the weekend.
                </div>
              </div>

              <div className="mt-6 border-t border-[#4A3737] pt-5 text-sm">
                {(booking.rate_type === "waitlist" ||
                  booking.rate_type === "sale" ||
                  booking.rate_type === "group" ||
                  booking.rate_type === "referral") &&
                Number(booking.section?.regular_package_price) * (booking.room_count ?? 1) >
                  (Number(booking.base_amount) || 0) ? (
                  <>
                    <Row
                      label="Package"
                      value={
                        Number(booking.section?.regular_package_price) * (booking.room_count ?? 1)
                      }
                    />
                    <Row
                      label={
                        booking.rate_type === "group"
                          ? (booking.event?.group_offer_name ?? "Two-room rate")
                          : booking.rate_type === "referral"
                            ? "Invitation rate"
                            : booking.rate_type === "sale"
                            ? "Sale discount"
                            : "Waitlist discount"
                      }
                      value={
                        (Number(booking.base_amount) || 0) -
                        Number(booking.section?.regular_package_price) * (booking.room_count ?? 1)
                      }
                    />
                  </>
                ) : (
                  <Row label="Package" value={Number(booking.base_amount) || 0} />
                )}
                {Number(booking.addon_amount) > 0 && (
                  <Row label="Enhancements" value={Number(booking.addon_amount)} />
                )}
                {Number(booking.resort_fee) > 0 && (
                  <Row label="Resort fee" value={Number(booking.resort_fee)} />
                )}
                <div className="mt-3 flex items-baseline justify-between border-t border-[#4A3737] pt-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-[#B8AFA6]">
                    {booking.payment_status === "deposit_paid"
                      ? "Weekend total (incl. tax)"
                      : "Paid (incl. tax)"}
                  </span>
                  <span className="font-serif text-xl text-[#F6F1E8]">
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
                  <p className="mt-2 text-xs text-[#B8AFA6]">
                    You paid 50% today. The remaining balance is automatically charged to the same
                    card
                    {payload?.event?.balance_due_on
                      ? ` on ${fmtDate(payload.event.balance_due_on)}`
                      : " before the weekend"}{" "}
                    — we'll email you a reminder first.
                  </p>
                )}
              </div>

              {booking.referral_code &&
                (Number(booking.event?.referral_reward_amount) > 0 ||
                  Number(booking.event?.referral_friend_percent) > 0) && (
                <div className="mt-6 rounded-[4px] border border-[#B8956A]/60 p-5">
                  <SectionLabel>Bring friends along</SectionLabel>
                  <div className="mt-2 font-serif text-2xl tracking-wide text-[#F6F1E8]">
                    {booking.referral_code}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#B8AFA6]">
                    {booking.payment_status === "deposit_paid" &&
                    Number(booking.event?.referral_reward_amount) > 0
                      ? `This is your personal invitation code. For every couple who reserves the weekend with it, $${Number(booking.event?.referral_reward_amount)} comes off the remaining balance of your stay${
                          Number(booking.event?.referral_friend_percent) > 0
                            ? `, and they receive ${Number(booking.event?.referral_friend_percent)}% off their own weekend`
                            : ""
                        }.`
                      : Number(booking.event?.referral_friend_percent) > 0
                        ? `This is your personal invitation code. Any couple who reserves with it receives ${Number(booking.event?.referral_friend_percent)}% off their weekend.`
                        : "This is your personal invitation code. Share it with a couple you would like to have along."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const link = `${window.location.origin}/stay/${eventSlug}?ref=${encodeURIComponent(booking.referral_code ?? "")}`;
                      navigator.clipboard?.writeText(link).then(
                        () => setCopied(true),
                        () => setCopied(false),
                      );
                    }}
                    className="mt-3 min-h-[44px] rounded border border-[#B8956A]/60 px-4 py-2 text-xs uppercase tracking-[0.16em] text-[#F6F1E8] transition-colors hover:border-[#B8956A]"
                  >
                    {copied ? "Link copied" : "Copy your invitation link"}
                  </button>
                </div>
              )}

              {includedItems.length > 0 && (
                <div className="mt-6 border-t border-[#4A3737] pt-5">
                  <SectionLabel>Your weekend includes</SectionLabel>
                  <ul className="mt-2 space-y-1">
                    {includedItems.map((it) => (
                      <li key={it.id} className="flex gap-2 text-xs text-[#E8E0D4]">
                        <span className="text-[#F09B9C]">✓</span>
                        <span>
                          {it.time_label ? `${it.time_label} — ` : ""}
                          {it.activity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-6 text-xs text-[#B8AFA6]">{CONTACT_LINE}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
