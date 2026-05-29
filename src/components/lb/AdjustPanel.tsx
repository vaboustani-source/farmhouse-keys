import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  supabase,
  type LbBooking,
  type LbRoomSection,
  type LbSectionAddon,
} from "@/integrations/supabase/client";
import { formatMoney } from "@/components/lb/AdminShell";

type Mode = "charge" | "refund";

async function callChargeAdditional(payload: {
  bookingId: string;
  amountCents: number;
  description: string;
  notes?: string;
  mode?: Mode;
}): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/charge-additional`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(payload),
    },
  );
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.ok) {
    return { ok: false, error: json.error || `HTTP ${resp.status}` };
  }
  return { ok: true };
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-primary/15 text-primary border-primary/30",
    deposit_paid: "bg-primary/15 text-primary border-primary/30",
    covered: "bg-primary/15 text-primary border-primary/30",
    pending: "bg-accent/20 text-accent-foreground border-accent/40",
    failed: "bg-destructive/15 text-destructive border-destructive/40",
    payment_failed: "bg-destructive/15 text-destructive border-destructive/40",
    refunded: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wider ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}

export function AdjustPanel({
  booking,
  section,
  onClose,
  onDone,
}: {
  booking: LbBooking;
  section: LbRoomSection;
  onClose: () => void;
  onDone: () => void;
}) {
  const [addons, setAddons] = useState<LbSectionAddon[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual charge fields
  const [mcAmount, setMcAmount] = useState("");
  const [mcDesc, setMcDesc] = useState("");
  const [mcNotes, setMcNotes] = useState("");
  const [mcConfirm, setMcConfirm] = useState(false);

  // Room override
  const [room, setRoom] = useState(booking.room_assignment ?? "");

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("lb_section_addons")
      .select("*")
      .eq("section_id", booking.section_id)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (!cancelled) setAddons((data ?? []) as LbSectionAddon[]);
      });
    return () => {
      cancelled = true;
    };
  }, [booking.section_id]);

  const cotRate =
    booking.nights_booked >= 2 ? Number(section.cot_2night_rate) : Number(section.cot_1night_rate);
  const status = booking.payment_status;
  const isPaid = status === "paid";
  const isDeposit = status === "deposit_paid";

  const selected = booking.addons_selected ?? [];
  const isSelected = (name: string) => selected.some((a) => a.name === name);

  async function refresh() {
    onDone();
  }

  async function handleAddCot() {
    if (cotRate <= 0) {
      setError("This section has no cot rate configured.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isPaid) {
        const res = await callChargeAdditional({
          bookingId: booking.id,
          amountCents: Math.round(cotRate * 100),
          description: "Cot added to reservation",
        });
        if (!res.ok) {
          setError(res.error || "Charge failed");
          setBusy(false);
          return;
        }
      }
      const { error: upErr } = await supabase
        .from("lb_bookings")
        .update({
          cot_requested: true,
          cot_fee: cotRate,
          total_amount: Number(booking.total_amount) + cotRate,
        })
        .eq("id", booking.id);
      if (upErr) throw upErr;
      toast.success(isPaid ? `Cot added and ${formatMoney(cotRate)} charged.` : "Cot added.");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleAddon(a: LbSectionAddon, on: boolean) {
    setBusy(true);
    setError(null);
    try {
      const price = Number(a.addon_price);
      const newList = on
        ? [...selected.filter((s) => s.name !== a.addon_name), { name: a.addon_name, price }]
        : selected.filter((s) => s.name !== a.addon_name);
      const newAddonAmount = newList.reduce((s, x) => s + Number(x.price ?? 0), 0);
      const diff = newAddonAmount - Number(booking.addon_amount);
      const newTotal = Number(booking.total_amount) + diff;

      if (isPaid && on && diff > 0) {
        const res = await callChargeAdditional({
          bookingId: booking.id,
          amountCents: Math.round(diff * 100),
          description: `Add-on: ${a.addon_name}`,
        });
        if (!res.ok) {
          setError(res.error || "Charge failed");
          setBusy(false);
          return;
        }
      } else if (isPaid && !on && diff < 0) {
        const res = await callChargeAdditional({
          bookingId: booking.id,
          amountCents: Math.round(-diff * 100),
          description: a.addon_name,
          mode: "refund",
        });
        if (!res.ok) {
          setError(res.error || "Refund failed");
          setBusy(false);
          return;
        }
      }

      const { error: upErr } = await supabase
        .from("lb_bookings")
        .update({
          addons_selected: newList,
          addon_amount: newAddonAmount,
          total_amount: newTotal,
        })
        .eq("id", booking.id);
      if (upErr) throw upErr;
      toast.success(on ? `Added ${a.addon_name}.` : `Removed ${a.addon_name}.`);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleManualCharge() {
    const dollars = Number(mcAmount);
    if (!dollars || dollars <= 0 || !mcDesc.trim()) {
      setError("Amount and description are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await callChargeAdditional({
        bookingId: booking.id,
        amountCents: Math.round(dollars * 100),
        description: mcDesc.trim(),
        notes: mcNotes.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error || "Charge failed");
        setBusy(false);
        return;
      }
      toast.success(`Charged ${formatMoney(dollars)}.`);
      setMcAmount("");
      setMcDesc("");
      setMcNotes("");
      setMcConfirm(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRoomBlur() {
    if ((room || "") === (booking.room_assignment ?? "")) return;
    const { error: upErr } = await supabase
      .from("lb_bookings")
      .update({ room_assignment: room || null })
      .eq("id", booking.id);
    if (upErr) toast.error(upErr.message);
    else {
      toast.success("Room updated.");
      refresh();
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h3 className="font-serif text-xl text-foreground">
            {booking.guest_name} · {section.section_name}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <PaymentBadge status={booking.payment_status} />
            <span className="text-xs text-muted-foreground">
              Total {formatMoney(booking.total_amount)}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Section 1 — Add a cot */}
      {!booking.cot_requested && (
        <Section title="Add a cot">
          <div className="flex items-center justify-between rounded border border-border bg-card p-3">
            <div>
              <div className="text-sm">Add a cot to this reservation</div>
              <div className="text-xs text-muted-foreground">
                {formatMoney(cotRate)} for the stay
                {isPaid && " · charged immediately"}
                {isDeposit && " · added to balance due"}
              </div>
            </div>
            <button
              onClick={handleAddCot}
              disabled={busy}
              className="rounded border border-primary/40 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-primary hover:bg-primary/5 disabled:opacity-50"
            >
              Add cot
            </button>
          </div>
        </Section>
      )}

      {/* Section 2 — Add-ons */}
      {addons.length > 0 && (
        <Section title="Add-ons">
          <div className="space-y-2">
            {addons.map((a) => {
              const on = isSelected(a.addon_name);
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded border border-border bg-card p-3"
                >
                  <div>
                    <div className="text-sm">{a.addon_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatMoney(Number(a.addon_price))} · {a.addon_type.replace("_", " ")}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleAddon(a, !on)}
                    disabled={busy}
                    className={`rounded border px-3 py-1.5 text-xs font-medium uppercase tracking-wider disabled:opacity-50 ${
                      on
                        ? "border-red-300 text-red-700 hover:bg-red-50"
                        : "border-primary/40 text-primary hover:bg-primary/5"
                    }`}
                  >
                    {on ? "Remove" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Section 3 — Manual charge */}
      <Section title="Charge an additional amount">
        <p className="mb-3 text-xs text-muted-foreground">
          For special requests, damage deposits, or other charges.
        </p>
        {!mcConfirm ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={mcAmount}
                  onChange={(e) => setMcAmount(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
                  Description
                </label>
                <input
                  value={mcDesc}
                  onChange={(e) => setMcDesc(e.target.value)}
                  placeholder="e.g. Late checkout fee"
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
                Notes (optional)
              </label>
              <textarea
                rows={2}
                value={mcNotes}
                onChange={(e) => setMcNotes(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const d = Number(mcAmount);
                  if (!d || d <= 0 || !mcDesc.trim()) {
                    setError("Amount and description are required.");
                    return;
                  }
                  setError(null);
                  setMcConfirm(true);
                }}
                disabled={busy || !mcAmount || !mcDesc.trim()}
                className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Charge {mcAmount ? formatMoney(Number(mcAmount) || 0) : ""}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm">
              Charge <strong>{formatMoney(Number(mcAmount) || 0)}</strong> to{" "}
              <strong>{booking.guest_name}</strong> for <strong>{mcDesc}</strong>?
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              This will be charged to their card on file.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setMcConfirm(false)}
                disabled={busy}
                className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleManualCharge}
                disabled={busy}
                className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Charging…" : "Confirm charge"}
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Section 4 — Override room assignment */}
      <Section title="Room assignment">
        <div className="flex items-center gap-3">
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            onBlur={handleRoomBlur}
            placeholder="Unassigned"
            className="w-64 rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-muted-foreground">Saves on blur</span>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}