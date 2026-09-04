import { useEffect, useState } from "react";
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

export type RefundRequestRow = {
  id: string;
  booking_id: string;
  status: string;
  refund_type: string;
  amount_cents: number;
  reason: string;
  notes: string | null;
  requested_by_email: string;
  requested_by_name: string | null;
  created_at: string;
  decided_by_email: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  error: string | null;
};

export const APPROVER_LABEL = "Sharon";

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
  const [pending, setPending] = useState<RefundRequestRow | null | undefined>(undefined);
  const [lastDecided, setLastDecided] = useState<RefundRequestRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from("lb_refund_requests")
      .select("*")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (!alive) return;
        const rows = (data ?? []) as RefundRequestRow[];
        setPending(rows.find((r) => r.status === "pending") ?? null);
        setLastDecided(rows.find((r) => r.status === "declined" || r.status === "failed") ?? null);
      });
    return () => {
      alive = false;
    };
  }, [booking.id]);

  const cancelRequest = async () => {
    if (!pending) return;
    setCancelling(true);
    const { error: upErr } = await supabase
      .from("lb_refund_requests")
      .update({ status: "cancelled" })
      .eq("id", pending.id);
    setCancelling(false);
    if (upErr) {
      toast.error(`Couldn't withdraw the request: ${upErr.message}`);
      return;
    }
    toast.success("Refund request withdrawn.");
    onDone();
  };
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
            action: "request",
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
        setError(`Couldn't send the request: ${json.error || "Unknown error"}`);
        setSubmitting(false);
        return;
      }
      toast.success(`Refund request for ${formatMoney(amountDollars)} sent to ${APPROVER_LABEL} for approval.`);
      onDone();
    } catch (err) {
      setError(`Couldn't send the request: ${(err as Error).message}`);
      setSubmitting(false);
    }
  };

  if (pending === undefined) {
    return (
      <div className="rounded-lg border border-border bg-background p-5 text-sm text-muted-foreground">
        Checking for open refund requests…
      </div>
    );
  }

  if (pending) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50/40 p-5">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h3 className="font-serif text-xl text-foreground">
              Refund waiting on {APPROVER_LABEL}
            </h3>
            <p className="text-xs text-muted-foreground">
              {booking.guest_name} · {sectionName}
            </p>
          </div>
          <button onClick={onClose} className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 rounded border border-border bg-background p-4 text-sm md:grid-cols-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Amount</div>
            <div className="tabular-nums">{formatMoney(pending.amount_cents / 100)} · {pending.refund_type}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Reason</div>
            <div>{pending.reason}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Requested by</div>
            <div>{pending.requested_by_name || pending.requested_by_email}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Sent</div>
            <div>{new Date(pending.created_at).toLocaleString()}</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Nothing has been refunded and the guest has not been contacted. {APPROVER_LABEL} has an email with Approve and Decline
          buttons; you will get an email either way. Withdraw it if the situation changed.
        </p>
        <div className="mt-3 flex justify-end">
          <button
            onClick={cancelRequest}
            disabled={cancelling}
            className="rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {cancelling ? "Withdrawing…" : "Withdraw request"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h3 className="font-serif text-xl text-foreground">
            Request a refund · {booking.guest_name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {sectionName} · {booking.guest_email}. Goes to {APPROVER_LABEL} for approval; nothing moves until she approves.
          </p>
          {lastDecided && (
            <p className="mt-1 text-xs text-amber-800">
              Last request was {lastDecided.status}
              {lastDecided.decided_by_email ? ` by ${lastDecided.decided_by_email}` : ""}
              {lastDecided.decision_notes ? ` — “${lastDecided.decision_notes}”` : ""}
              {lastDecided.error ? ` — ${lastDecided.error}` : ""}.
            </p>
          )}
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
              className="rounded bg-[#2C3E2D] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1f2d20] disabled:opacity-50"
            >
              Continue to request
            </button>
          </div>
        </>
      ) : (
        <div className="rounded border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-sm text-foreground">
            Send a request to refund <strong>{formatMoney(amountDollars)}</strong> to <strong>{booking.guest_name}</strong> to {APPROVER_LABEL}?
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            She gets an email with the details and Approve / Decline buttons. If she approves, the money goes back to the guest's
            original payment method and the guest is emailed. Until then, nothing changes.
          </p>
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
              className="rounded bg-[#2C3E2D] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1f2d20] disabled:opacity-50"
            >
              {submitting ? "Sending…" : `Send to ${APPROVER_LABEL} for approval`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}