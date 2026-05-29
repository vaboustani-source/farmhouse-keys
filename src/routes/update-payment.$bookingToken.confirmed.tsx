import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/update-payment/$bookingToken/confirmed")({
  component: ConfirmedPage,
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

function ConfirmedPage() {
  const { bookingToken } = Route.useParams();
  const [info, setInfo] = useState<
    | { loading: true }
    | { loading: false; balance: number; chargeDate: string | null; sectionName: string }
  >({ loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The token is null after success — look up by id via the edge function isn't
      // possible anymore, so just query the booking directly using a public RPC-free
      // path: we ask the create-setup-intent fn which returns 'paid' or summary even
      // when token is invalidated. Fallback: empty state.
      try {
        const { data } = await supabase.functions.invoke("create-setup-intent", {
          body: { bookingToken },
        });
        if (cancelled) return;
        const b = data?.booking;
        if (b) {
          setInfo({
            loading: false,
            balance: Number(b.balance ?? 0),
            chargeDate: b.chargeDate ?? null,
            sectionName: b.sectionName ?? "",
          });
        } else {
          setInfo({ loading: false, balance: 0, chargeDate: null, sectionName: "" });
        }
      } catch {
        if (!cancelled) setInfo({ loading: false, balance: 0, chargeDate: null, sectionName: "" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingToken]);

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

        <h1 className="mt-12 text-center font-serif text-3xl font-medium text-[#1A1A1A] md:text-4xl">
          Payment method saved.
        </h1>
        {!info.loading && info.balance > 0 && (
          <p className="mt-3 text-center text-sm text-[#6B6B6B]">
            Your balance of <strong>{fmtMoney(info.balance)}</strong> will be
            automatically charged on <strong>{fmtDate(info.chargeDate)}</strong>.
            No further action needed.
          </p>
        )}

        {!info.loading && info.balance > 0 && (
          <div className="mt-8 rounded-md border border-[#E8E2D9] bg-white p-6">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-[#6B6B6B]">Balance due</dt>
              <dd className="text-right tabular-nums">{fmtMoney(info.balance)}</dd>
              <dt className="text-[#6B6B6B]">Charge date</dt>
              <dd className="text-right tabular-nums">{fmtDate(info.chargeDate)}</dd>
              <dt className="text-[#6B6B6B]">Lodging</dt>
              <dd className="text-right">{info.sectionName || "—"}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}