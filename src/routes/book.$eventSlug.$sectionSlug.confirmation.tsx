import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fetchSessionConfirmation } from "@/lib/booking.functions";

export const Route = createFileRoute("/book/$eventSlug/$sectionSlug/confirmation")({
  component: ConfirmationPage,
});

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

type Bookings = Awaited<ReturnType<typeof fetchSessionConfirmation>>["bookings"];

function ConfirmationPage() {
  const fetcher = useServerFn(fetchSessionConfirmation);
  const [bookings, setBookings] = useState<Bookings>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setLoading(false);
      return;
    }
    // Stripe webhook may take a moment — poll briefly
    let attempts = 0;
    const tick = async () => {
      const { bookings } = await fetcher({ data: { sessionId } });
      const ready = bookings.find(
        (b) => b.payment_status === "paid" || b.payment_status === "deposit_paid" || b.payment_status === "covered",
      );
      if (ready || attempts >= 8) {
        setBookings(bookings);
        setLoading(false);
      } else {
        attempts++;
        setTimeout(tick, 1500);
      }
    };
    tick();
  }, [fetcher]);

  const primary = bookings.find((b) => b.is_primary || !b.covered_by_booking_id);
  const secondary = bookings.find((b) => b.covered_by_booking_id);

  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans text-[#1A1A1A]">
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="font-serif text-2xl tracking-wide text-[#2C3E2D]">Gilbertsville Farmhouse</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[#6B6B6B]">A private estate</div>

        {loading && <p className="mt-16 text-sm text-[#6B6B6B]">Confirming your reservation…</p>}

        {!loading && primary && (
          <>
            <h1 className="mt-12 font-serif text-4xl font-medium md:text-5xl">
              {primary.payment_status === "deposit_paid" ? "Your room is reserved." : "You're confirmed."}
            </h1>
            {primary.payment_status === "deposit_paid" && (
              <p className="mt-3 text-sm text-[#6B6B6B]">Your deposit is confirmed.</p>
            )}

            <div className="mt-10 rounded-md border border-[#E8E2D9] bg-white p-6 text-left">
              <div className="font-serif text-xl">{primary.guest_name}</div>
              <div className="mt-1 text-sm text-[#6B6B6B]">{primary.section?.section_name}</div>
              <div className="mt-3 space-y-1 text-sm">
                <Row label="Check-in" value={fmtDate(primary.event?.check_in_date)} />
                <Row label="Check-out" value={fmtDate(primary.event?.check_out_date)} />
                {primary.payment_status === "deposit_paid" ? (
                  <Row
                    label="Deposit paid today"
                    value={fmtMoney(Number(primary.total_amount) * 0.5)}
                  />
                ) : (
                  <Row label="Total paid" value={fmtMoney(Number(primary.total_amount))} />
                )}
              </div>
              {primary.payment_status === "deposit_paid" && (
                <p className="mt-4 text-xs text-[#6B6B6B]">
                  Your remaining balance of {fmtMoney(Number(primary.total_amount) * 0.5)} will be requested before check-in.
                </p>
              )}
              <p className="mt-4 text-xs text-[#6B6B6B]">A confirmation has been sent to {primary.guest_email}.</p>
            </div>

            {secondary && (
              <div className="mt-4 rounded-md border border-[#E8E2D9] bg-white p-6 text-left">
                <div className="font-serif text-xl">{secondary.guest_name}'s room is confirmed too.</div>
                <div className="mt-1 text-sm text-[#6B6B6B]">{secondary.section?.section_name}</div>
                <p className="mt-3 text-xs text-[#6B6B6B]">
                  A confirmation has been sent to {secondary.guest_email}.
                </p>
              </div>
            )}

            <p className="mt-12 font-serif text-lg text-[#6B6B6B]">We look forward to welcoming you.</p>
            <a
              href="https://gilbertsvillefarmhouse.com"
              className="mt-2 inline-block text-xs uppercase tracking-[0.16em] text-[#2C3E2D] hover:text-[#C9A84C]"
            >
              gilbertsvillefarmhouse.com
            </a>
          </>
        )}

        {!loading && !primary && (
          <p className="mt-16 text-sm text-[#6B6B6B]">
            We couldn't find your reservation. Please reach out to your planning team.
          </p>
        )}
      </div>
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