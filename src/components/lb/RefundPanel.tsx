import { useState } from "react";
import { toast } from "sonner";
import { supabase, type LbBooking } from "@/integrations/supabase/client";
import { formatMoney } from "@/components/lb/AdminShell";

const REASONS = [
  "Guest cancellation (within policy)",
  "Guest cancellation (outside policy — discretionary)",
  "Wedding postponed",
  "Wedding cancelled",
  "Duplicate booking",
  "Admin correction",
  "Other",
];

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const t = new Date(date + "T00:00:00").getTime();
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}

function paidToDate(b: LbBooking): { total: number; deposit: number; final: number } {
  const status = b.payment_status;
  if (status === "paid" || status === "covered") {
    return { total: Number(b.total_amount), deposit: 0, final: Number(b.total_amount) };
  }
  if (status === "deposit_paid") {
    const deposit = Number(b.total_amount) / 2;
    return { total: deposit, deposit, final: 0 };
  }
  return { total: 0, deposit: 0, final: 0 };
}

export function RefundPanel({
  booking,
  sectionName,
  checkInDate,
  onClose,
  onDone,
}: {
  booking: LbBooking;
  sectionName: string;
  checkInDate: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const paid = paidToDate(booking);
  const days = daysUntil(checkInDate);
  const withinWindow = days !== null && days <= 45;
  const splitSchedule = booking.payment_status === "deposit_paid";

  const [type, setType] = useState<"full" | "partial" | "deposit">(
    withinWindow ? "partial" : "full",
  );
  const [partialAmount, setPartialAmount] = useState<string>(paid.total.toFixed(2));
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountDollars =
    type === "full"
      ? paid.total
      : type === "deposit"
      ? paid.deposit
      : Math.min(Math.max(Number(partialAmount) || 0, 0), paid.total);
  const amountCents = Math.round(amountDollars * 100);

  const canProcess = amountCents > 0 && reason && !submitting;

  const process = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-refund`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
            authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            bookingId: booking.id,
            refundType: type,
            amount: amountCents,
            reason,
            notes,
          }),
        },
      );
      const json = await resp.json();
      if (!resp.ok) {
        setError(
          `Refund failed: ${json.error || "Unknown error"}. Please process manually in the Stripe dashboard.`,
        );
        setSubmitting(false);
        return;
      }
      toast.success(`Refund of ${formatMoney(amountDollars)} processed.`);
      onDone();
    } catch (err) {
      setError(
        `Refund failed: ${(err as Error).message}. Please process manually in the Stripe dashboard.`,
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h3 className="font-serif text-xl text-foreground">
            {booking.guest_name} · {sectionName}
          </h3>
          <p className="text-xs text-muted-foreground">{booking.guest_email}</p>
        </div>
        <button onClick={onClose} className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-1 rounded border border-border bg-muted/30 p-4 text-sm md:grid-cols-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Paid to date</div>
          <div className="tabular-nums">{formatMoney(paid.total)}</div>
        </div>
        {splitSchedule && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Deposit paid</div>
            <div className="tabular-nums">{formatMoney(paid.deposit)}</div>
          </div>
        )}
        {paid.final > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Final payment</div>
            <div className="tabular-nums">{formatMoney(paid.final)}</div>
          </div>
        )}
        {booking.stripe_payment_intent_id && (
          <div className="col-span-2 md:col-span-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Stripe PI</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {booking.stripe_payment_intent_id}
            </div>
          </div>
        )}
      </div>

      {!confirm ? (
        <>
          <div className="mb-4 space-y-2">
            <label className={`flex items-start gap-3 rounded border p-3 ${withinWindow ? "border-border opacity-50" : type === "full" ? "border-foreground" : "border-border"} ${!withinWindow ? "cursor-pointer" : ""}`}>
              <input
                type="radio"
                name="rt"
                value="full"
                checked={type === "full"}
                disabled={withinWindow}
                onChange={() => setType("full")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">Full refund</div>
                <div className="text-xs text-muted-foreground">
                  Refunds entire amount paid to date ({formatMoney(paid.total)}).
                </div>
                {withinWindow && (
                  <div className="mt-1 text-xs text-amber-700">
                    Outside cancellation window — full refund not available per policy.
                  </div>
                )}
              </div>
            </label>

            <label className={`flex items-start gap-3 rounded border p-3 cursor-pointer ${type === "partial" ? "border-foreground" : "border-border"}`}>
              <input
                type="radio"
                name="rt"
                value="partial"
                checked={type === "partial"}
                onChange={() => setType("partial")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">Partial refund</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={paid.total}
                    value={partialAmount}
                    onChange={(e) => {
                      setPartialAmount(e.target.value);
                      setType("partial");
                    }}
                    className="w-32 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">max {formatMoney(paid.total)}</span>
                </div>
              </div>
            </label>

            {splitSchedule && (
              <label className={`flex items-start gap-3 rounded border p-3 cursor-pointer ${type === "deposit" ? "border-foreground" : "border-border"}`}>
                <input
                  type="radio"
                  name="rt"
                  value="deposit"
                  checked={type === "deposit"}
                  onChange={() => setType("deposit")}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Deposit only</div>
                  <div className="text-xs text-muted-foreground">
                    Refunds the deposit ({formatMoney(paid.deposit)}) and cancels the scheduled balance charge.
                  </div>
                </div>
              </label>
            )}
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
                Notes (optional)
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={() => setConfirm(true)}
              disabled={!canProcess}
              className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </>
      ) : (
        <div className="rounded border border-red-200 bg-red-50/50 p-4">
          <p className="text-sm text-foreground">
            Refund <strong>{formatMoney(amountDollars)}</strong> to <strong>{booking.guest_name}</strong>?
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            This will be returned to their original payment method.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">This action cannot be undone.</p>
          {error && (
            <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setConfirm(false)}
              disabled={submitting}
              className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={process}
              disabled={submitting}
              className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Processing…" : "Process refund"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}