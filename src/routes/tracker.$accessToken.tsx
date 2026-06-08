import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTrackerData, sendNudge } from "@/lib/tracker.functions";

export const Route = createFileRoute("/tracker/$accessToken")({
  component: TrackerPage,
});

const SECTION_ORDER = [
  "The Hearth Village",
  "Farmhouse Residence",
  "The Grove Guesthouses",
  "The Victoria Cabins",
];
const SHORT_NAME: Record<string, string> = {
  "The Hearth Village": "Hearth",
  "Farmhouse Residence": "Farmhouse",
  "The Grove Guesthouses": "Grove",
  "The Victoria Cabins": "Victoria",
};
const WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five",
  "Six", "Seven", "Eight", "Nine", "Ten",
];
const CONFIRMED = new Set(["paid", "deposit_paid", "covered"]);

const fmtDate = (d: string | null) =>
  d
    ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString(
        "en-US",
        { weekday: "long", month: "long", day: "numeric" },
      )
    : "";

type TrackerEvent = NonNullable<
  Awaited<ReturnType<typeof getTrackerData>>["event"]
>;
type Booking = TrackerEvent["bookings"][number];
type Section = TrackerEvent["sections"][number];

function TrackerPage() {
  const { accessToken } = Route.useParams();
  const fetcher = useServerFn(getTrackerData);
  const [event, setEvent] = useState<TrackerEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = async () => {
    const { event } = await fetcher({ data: { token: accessToken } });
    if (!event) {
      setNotFound(true);
    } else {
      setEvent(event);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Realtime: refetch on any lb_bookings change for this event.
  useEffect(() => {
    if (!event?.eventId) return;
    const channel = supabase
      .channel(`tracker_${event.eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lb_bookings", filter: `event_id=eq.${event.eventId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.eventId]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#FAF8F4] font-sans text-[#1A1A1A]">
        <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-[#6B6B6B]">
          Loading…
        </div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#FAF8F4] px-6 font-sans text-[#1A1A1A]">
        <div className="max-w-md text-center">
          <div className="font-serif text-2xl text-[#2C3E2D]">Gilbertsville Farmhouse</div>
          <p className="mt-8 font-serif text-2xl">
            This link doesn't seem right.
          </p>
          <p className="mt-3 text-sm text-[#6B6B6B]">
            Reach out to your planning team.
          </p>
        </div>
      </div>
    );
  }

  const orderedSections: Section[] = [...event.sections].sort(
    (a, b) =>
      SECTION_ORDER.indexOf(a.section_name) - SECTION_ORDER.indexOf(b.section_name),
  );
  const totalConfirmed = event.bookings.filter((b) =>
    CONFIRMED.has(b.payment_status),
  ).length;

  return (
    <div className="min-h-dvh bg-[#FAF8F4] font-sans text-[#1A1A1A]">
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        {/* Header */}
        <div className="text-center">
          <div className="font-serif text-2xl tracking-wide text-[#2C3E2D]">
            Gilbertsville Farmhouse
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.24em] text-[#6B6B6B]">
            A private estate
          </div>
          <div className="mx-auto mt-6 h-px w-16 bg-[#C9A84C]" />
          <h1 className="mt-8 font-serif text-3xl font-medium md:text-4xl lg:text-5xl break-words">
            {event.coupleNames}'s Weekend
          </h1>
          <p className="mt-3 text-sm text-[#6B6B6B]">
            {fmtDate(event.checkInDate)} → {fmtDate(event.checkOutDate)}
          </p>
        </div>

        {/* Summary strip */}
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
          {orderedSections.map((s) => {
            const filled = event.bookings.filter(
              (b) => b.section_id === s.id && CONFIRMED.has(b.payment_status),
            ).length;
            return (
              <SummaryCard
                key={s.id}
                name={SHORT_NAME[s.section_name] ?? s.section_name}
                filled={filled}
                total={s.total_rooms}
              />
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <div className="font-serif text-[32px] leading-tight">
            {totalConfirmed} of 40 guests confirmed
          </div>
          <div className="mt-1 text-sm text-[#6B6B6B]">
            across all four lodging sections
          </div>
        </div>

        {/* Section panels */}
        <div className="mt-12 space-y-6">
          {orderedSections.map((s) => (
            <SectionPanel
              key={s.id}
              section={s}
              bookings={event.bookings.filter((b) => b.section_id === s.id)}
              accessToken={accessToken}
              onAfterNudge={refresh}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-20 text-center">
          <p className="text-sm text-[#6B6B6B]">
            Questions? Reach out to your planning team.
          </p>
          <a
            href="https://gilbertsvillefarmhouse.com"
            className="mt-2 inline-flex min-h-[44px] items-center px-3 py-2 text-xs uppercase tracking-[0.16em] text-[#2C3E2D] hover:text-[#C9A84C] focus-visible:text-[#C9A84C]"
          >
            gilbertsvillefarmhouse.com
          </a>
        </div>
      </div>
    </div>
  );
}

function barColor(filled: number, total: number) {
  if (filled >= total) return "bg-[#2C3E2D]";
  if (filled >= 5) return "bg-[#C9A84C]";
  return "bg-[#E8E2D9]";
}

function SummaryCard({
  name,
  filled,
  total,
}: {
  name: string;
  filled: number;
  total: number;
}) {
  const isFull = filled >= total;
  return (
    <div className="rounded-md border border-[#E8E2D9] bg-white p-4">
      <div className="flex items-baseline justify-between">
        <div className="font-serif text-lg">{name}</div>
        <div className="text-xs tabular-nums text-[#6B6B6B]">
          {filled}/{total}
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#F1ECE3]">
        <div
          className={`h-full ${barColor(filled, total)} transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(100, (filled / Math.max(total, 1)) * 100)}%` }}
        />
      </div>
      {isFull && (
        <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[#2C3E2D]">
          Full
        </div>
      )}
    </div>
  );
}

function SectionPanel({
  section,
  bookings,
  accessToken,
  onAfterNudge,
}: {
  section: Section;
  bookings: Booking[];
  accessToken: string;
  onAfterNudge: () => void;
}) {
  const confirmed = bookings.filter((b) => CONFIRMED.has(b.payment_status));
  const pending = bookings.filter((b) => b.payment_status === "pending");
  const filled = confirmed.length;
  const total = section.total_rooms;
  const isFull = filled >= total;
  const word = WORDS[Math.min(filled, 10)] ?? String(filled);

  return (
    <div className="rounded-md border border-[#E8E2D9] bg-white">
      <div className="border-b border-[#E8E2D9] p-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-2xl">{section.section_name}</h2>
          <div className="text-xs text-[#6B6B6B]">
            {word} of ten confirmed
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#F1ECE3]">
          <div
            className={`h-full ${barColor(filled, total)} transition-all duration-700 ease-out`}
            style={{ width: `${Math.min(100, (filled / Math.max(total, 1)) * 100)}%` }}
          />
        </div>
      </div>

      {isFull ? (
        <div className="bg-[#2C3E2D] py-8 text-center">
          <div className="font-serif text-2xl text-white">Everyone's in.</div>
        </div>
      ) : (
        <div className={`grid gap-6 p-6 ${pending.length > 0 ? "md:grid-cols-2" : ""}`}>
          {/* Confirmed */}
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[#6B6B6B]">
              Confirmed
            </div>
            {confirmed.length === 0 ? (
              <p className="text-sm italic text-[#9A9188]">None confirmed yet.</p>
            ) : (
              <ul className="space-y-3">
                {confirmed.map((b) => (
                  <li key={b.id} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-[#2C3E2D]" />
                    <div>
                      <div className="text-sm">{b.guest_name}</div>
                      <div className="text-[11px] text-[#6B6B6B]">
                        Confirmed{" "}
                        {fmtDate(
                          (b.final_paid_at ??
                            b.deposit_paid_at ??
                            b.covered_at ??
                            b.booked_at ??
                            "")?.slice(0, 10) || null,
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[#6B6B6B]">
                Still to confirm
              </div>
              <ul className="space-y-3">
                {pending.map((b) => (
                  <PendingRow
                    key={b.id}
                    booking={b}
                    accessToken={accessToken}
                    onAfterNudge={onAfterNudge}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PendingRow({
  booking,
  accessToken,
  onAfterNudge,
}: {
  booking: Booking;
  accessToken: string;
  onAfterNudge: () => void;
}) {
  const nudge = useServerFn(sendNudge);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reminderCount = booking.reminder_count ?? 0;
  const maxReached = reminderCount >= 3;
  const sentAt = booking.reminder_sent_at;
  const ageMs = sentAt ? Date.now() - new Date(sentAt).getTime() : Infinity;
  const withinCooldown = ageMs < 48 * 60 * 60 * 1000;

  const handleSend = async () => {
    setSending(true);
    setErrorMsg(null);
    try {
      const res = await nudge({ data: { token: accessToken, bookingId: booking.id } });
      if (!res.ok) {
        setErrorMsg(
          res.reason === "cooldown"
            ? "Already nudged within the past 48 hours."
            : res.reason === "max_reached"
              ? "Reached out 3 times."
              : "Couldn't send right now.",
        );
      } else {
        onAfterNudge();
      }
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  return (
    <li className="flex items-start gap-2.5">
      <Clock className="mt-0.5 h-4 w-4 flex-none text-[#9A9188]" />
      <div className="flex-1">
        <div className="text-sm">{booking.guest_name}</div>
        {sentAt && withinCooldown && !confirming ? (
          <div className="mt-1 text-[11px] text-[#6B6B6B]">
            Nudged {fmtDate(sentAt.slice(0, 10))}
          </div>
        ) : maxReached ? (
          <div className="mt-1 text-[11px] text-[#6B6B6B]">Reached out 3 times</div>
        ) : confirming ? (
          <div className="mt-2 rounded border border-[#E8E2D9] bg-[#FAF8F4] p-3">
            <p className="text-xs text-[#1A1A1A]">
              Send a reminder to {booking.guest_name}?
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSend}
                disabled={sending}
                className="rounded bg-[#C9A84C] px-4 py-3 min-h-[44px] text-xs uppercase tracking-[0.16em] text-white hover:bg-[#b8973f] disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="rounded border border-[#E8E2D9] px-4 py-3 min-h-[44px] text-xs uppercase tracking-[0.16em] text-[#6B6B6B] hover:text-[#1A1A1A]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="mt-1 inline-flex min-h-[44px] items-center rounded border border-transparent px-3 py-2 text-xs uppercase tracking-[0.16em] text-[#2C3E2D] transition-colors hover:border-[#C9A84C]"
          >
            Nudge
          </button>
        )}
        {errorMsg && (
          <div className="mt-1 text-[11px] text-[#6B6B6B]">{errorMsg}</div>
        )}
      </div>
    </li>
  );
}