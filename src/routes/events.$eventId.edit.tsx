import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Copy, Plus, Send, Trash2 } from "lucide-react";
import {
  supabase,
  type LbEvent,
  type LbRoomSection,
  type LbSectionAddon,
} from "@/integrations/supabase/client";
import { AdminShell, formatMoney } from "@/components/lb/AdminShell";
import { EventLayout } from "@/components/lb/EventNav";

export const Route = createFileRoute("/events/$eventId/edit")({
  component: EditEventPage,
});

async function fetchEvent(id: string) {
  const [evt, sec, ad] = await Promise.all([
    supabase.from("lb_events").select("*").eq("id", id).single(),
    supabase.from("lb_room_sections").select("*").eq("event_id", id).order("sort_order"),
    supabase.from("lb_section_addons").select("*").eq("event_id", id).order("sort_order"),
  ]);
  if (evt.error) throw evt.error;
  return {
    event: evt.data as LbEvent,
    sections: (sec.data ?? []) as LbRoomSection[],
    addons: (ad.data ?? []) as LbSectionAddon[],
  };
}

function EditEventPage() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["lb_event", eventId],
    queryFn: () => fetchEvent(eventId),
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const updateEvent = useMutation({
    mutationFn: async (patch: Partial<LbEvent>) => {
      const { error } = await supabase.from("lb_events").update(patch).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      qc.invalidateQueries({ queryKey: ["lb_event", eventId] });
    },
  });

  if (isLoading || !data) {
    return (
      <AdminShell>
      <EventLayout eventId={eventId} currentTab="settings">
        <div className="text-sm text-muted-foreground">Opening the block…</div>
      </EventLayout>
    </AdminShell>
    );
  }

  const { event, sections, addons } = data;

  const activate = async () => {
    const activeSections = sections.filter((s) => s.is_active);
    if (!activeSections.length) {
      toast.error("Activate at least one section before publishing.");
      return;
    }
    await updateEvent.mutateAsync({ status: "active" });
    toast.success("Event activated. Booking links are live.");
    navigate({ to: "/events/$eventId", params: { eventId } });
  };

  return (
    <AdminShell>
      <EventLayout eventId={eventId} currentTab="settings">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-y-3 gap-x-6">
        <div className="min-w-0">
          <Link to="/" className="text-xs uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
            ← All blocks
          </Link>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-medium text-foreground break-words">
            {event.couple_names}
          </h1>
          <p className="text-sm text-muted-foreground">{event.wedding_name}</p>
        </div>
        {savedAt && (
          <div className="text-xs text-muted-foreground">Last saved at {savedAt}</div>
        )}
      </div>

      <EventDetailsCard event={event} onSave={(p) => updateEvent.mutate(p)} />

      <div className="mt-10 mb-4 flex items-center justify-between">
        <h2 className="font-serif text-2xl text-foreground">The four houses</h2>
        <span className="text-xs text-muted-foreground">Each house holds ten rooms.</span>
      </div>

      <div className="space-y-4">
        {sections.map((s) => (
          <SectionCard
            key={s.id}
            section={s}
            event={event}
            addons={addons.filter((a) => a.section_id === s.id)}
            onSaved={() => {
              setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
              qc.invalidateQueries({ queryKey: ["lb_event", eventId] });
            }}
          />
        ))}
      </div>

      <div className="mt-10 flex justify-end gap-3 border-t border-border pt-6">
        <button
          onClick={() => updateEvent.mutate({ status: "draft" })}
          className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground hover:bg-muted"
        >
          Save as draft
        </button>
        <button
          onClick={activate}
          className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Activate event
        </button>
      </div>
      </EventLayout>
    </AdminShell>
  );
}

function EventDetailsCard({ event, onSave }: { event: LbEvent; onSave: (p: Partial<LbEvent>) => void }) {
  const [local, setLocal] = useState(event);
  useEffect(() => setLocal(event), [event]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = (patch: Partial<LbEvent>) => {
    setLocal((p) => ({ ...p, ...patch }));
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => onSave(patch), 600);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Couple">
          <input className="lb-input" value={local.couple_names} onChange={(e) => queue({ couple_names: e.target.value })} />
        </Field>
        <Field label="Wedding name">
          <input className="lb-input" value={local.wedding_name} onChange={(e) => queue({ wedding_name: e.target.value })} />
        </Field>
        <Field label="Wedding date">
          <input type="date" className="lb-input" value={local.wedding_date ?? ""} onChange={(e) => queue({ wedding_date: e.target.value })} />
        </Field>
        <Field label="Nights">
          <input type="number" min={1} className="lb-input" value={local.nights}
            onChange={(e) => queue({ nights: parseInt(e.target.value) || 1 })} />
        </Field>
        <Field label="Check-in">
          <input type="date" className="lb-input" value={local.check_in_date ?? ""} onChange={(e) => queue({ check_in_date: e.target.value })} />
        </Field>
        <Field label="Check-out">
          <input type="date" className="lb-input" value={local.check_out_date ?? ""} onChange={(e) => queue({ check_out_date: e.target.value })} />
        </Field>
        <Field label="Resort fee %">
          <input type="number" min={0} step={0.5} className="lb-input" value={local.resort_fee_pct}
            onChange={(e) => queue({ resort_fee_pct: parseFloat(e.target.value) || 0 })} />
        </Field>
        <Field label="NY tax %">
          <input type="number" min={0} step={0.1} className="lb-input" value={local.tax_pct}
            onChange={(e) => queue({ tax_pct: parseFloat(e.target.value) || 0 })} />
        </Field>
        <Field label="Check-in time">
          <input
            type="text"
            className="lb-input"
            value={local.check_in_time ?? "3:00 PM"}
            onChange={(e) => queue({ check_in_time: e.target.value } as Partial<LbEvent>)}
            placeholder="3:00 PM"
          />
        </Field>
        <Field label="Check-out time">
          <input
            type="text"
            className="lb-input"
            value={local.check_out_time ?? "11:00 AM"}
            onChange={(e) => queue({ check_out_time: e.target.value } as Partial<LbEvent>)}
            placeholder="11:00 AM"
          />
        </Field>
      </div>
      {event.status === "active" && (
        <div className="mt-5 border-t border-border pt-4">
          <SendCheckinRemindersButton eventId={event.id} />
        </div>
      )}
      <LbInputStyle />
    </div>
  );
}

function SendCheckinRemindersButton({ eventId }: { eventId: string }) {
  const [busy, setBusy] = useState(false);

  const trigger = async () => {
    const ok = window.confirm(
      "Send check-in reminder emails to all confirmed guests for this event?",
    );
    if (!ok) return;
    setBusy(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-checkin-reminders`;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ event_id: eventId }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { sent?: number };
      toast.success(`Reminders sent to ${json.sent ?? 0} guests`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminders");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={trigger}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-foreground hover:bg-muted disabled:opacity-50"
    >
      <Send className="h-3.5 w-3.5" />
      {busy ? "Sending…" : "Send check-in reminders now"}
    </button>
  );
}

function SectionCard({
  section,
  event,
  addons,
  onSaved,
}: {
  section: LbRoomSection;
  event: LbEvent;
  addons: LbSectionAddon[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [local, setLocal] = useState(section);
  useEffect(() => setLocal(section), [section]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveSection = (patch: Partial<LbRoomSection>) => {
    setLocal((p) => ({ ...p, ...patch }));
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const { error } = await supabase.from("lb_room_sections").update(patch).eq("id", section.id);
      if (error) toast.error(error.message);
      else onSaved();
    }, 500);
  };

  const addAddon = async () => {
    const { error } = await supabase.from("lb_section_addons").insert({
      event_id: event.id,
      section_id: section.id,
      addon_name: "New enhancement",
      addon_price: 0,
      addon_type: "per_stay",
      is_active: true,
    });
    if (error) toast.error(error.message);
    else onSaved();
  };

  const guestNightly = Math.max(
    (local.internal_nightly_rate ?? 0) - (local.couple_contribution ?? 0),
    0,
  );
  const nights = event.nights || 2;
  const baseTotal = guestNightly * nights;
  const resort = baseTotal * ((local.resort_fee_percent ?? 0) / 100);
  const tax = (baseTotal + resort) * 0.08;
  const previewTotal = baseTotal + resort + tax;

  const bookingUrl =
    local.booking_link_slug && event.slug
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/book/${event.slug}/${local.booking_link_slug}`
      : null;

  const copyLink = async () => {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl);
    toast.success("Link copied — ready to send");
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-5 text-left hover:bg-muted/30"
      >
        <div>
          <div className="font-serif text-xl text-foreground">{local.section_name}</div>
          <div className="text-xs text-muted-foreground">
            10 rooms · {formatMoney(local.price_per_night)}/night · {addons.filter((a) => a.is_active).length} add-ons
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--primary)]"
              checked={local.is_active}
              onChange={(e) => saveSection({ is_active: e.target.checked })}
            />
            <span className="uppercase tracking-wider">{local.is_active ? "Active" : "Inactive"}</span>
          </label>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field label="Price per night">
              <input
                type="number"
                min={0}
                step={1}
                className="lb-input"
                value={local.price_per_night}
                onChange={(e) => saveSection({ price_per_night: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Nightly Rate ($)">
              <input
                type="number"
                min={0}
                step={1}
                className="lb-input"
                value={local.internal_nightly_rate ?? 0}
                onChange={(e) => saveSection({ internal_nightly_rate: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Couple Contribution ($)">
              <input
                type="number"
                min={0}
                step={1}
                className="lb-input"
                value={local.couple_contribution ?? 0}
                onChange={(e) => saveSection({ couple_contribution: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Resort Fee %">
              <input
                type="number"
                min={0}
                step={0.5}
                className="lb-input"
                value={local.resort_fee_percent ?? 0}
                onChange={(e) => saveSection({ resort_fee_percent: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Processing fee %">
              <input
                type="number"
                min={0}
                step={0.1}
                className="lb-input"
                value={local.processing_fee_percent ?? 0}
                onChange={(e) => saveSection({ processing_fee_percent: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Tax %">
              <input
                type="number"
                min={0}
                step={0.1}
                className="lb-input"
                value={local.tax_percent ?? 0}
                onChange={(e) => saveSection({ tax_percent: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Payment Schedule">
              <select
                className="lb-input"
                value={local.payment_schedule ?? "deposit_50_balance_50"}
                onChange={(e) => saveSection({ payment_schedule: e.target.value as LbRoomSection["payment_schedule"] })}
              >
                <option value="full">Full payment at booking</option>
                <option value="deposit_50_balance_50">50% now, 50% before arrival</option>
              </select>
            </Field>
            <Field label="Cot — 1 night flat rate ($)">
              <input
                type="number"
                min={0}
                step={1}
                className="lb-input"
                value={local.cot_1night_rate ?? 100}
                onChange={(e) => saveSection({ cot_1night_rate: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Cot — 2 night flat rate ($)">
              <input
                type="number"
                min={0}
                step={1}
                className="lb-input"
                value={local.cot_2night_rate ?? 150}
                onChange={(e) => saveSection({ cot_2night_rate: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <div className="sm:col-span-2 rounded-md border border-border bg-background/60 p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Guest-facing total (estimated)
              </div>
              <div className="mt-2 text-sm text-foreground">
                Guests will see:{" "}
                <span className="font-serif tabular-nums">{formatMoney(guestNightly)}</span>/night
              </div>
              <div className="mt-1 text-sm text-foreground">
                {nights} nights + fees:{" "}
                <span className="font-serif tabular-nums">{formatMoney(previewTotal)}</span> per room
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
                <span>Base ({nights} × {formatMoney(guestNightly)})</span>
                <span className="text-right tabular-nums">{formatMoney(baseTotal)}</span>
                <span>Resort fee ({local.resort_fee_percent ?? 0}%)</span>
                <span className="text-right tabular-nums">{formatMoney(resort)}</span>
                <span>Tax (8% est.)</span>
                <span className="text-right tabular-nums">{formatMoney(tax)}</span>
              </div>
            </div>
          </div>

          {local.is_active && bookingUrl && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-accent/40 bg-accent/10 p-3">
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Booking link</span>
              <code className="min-w-0 flex-1 truncate text-xs text-foreground">{bookingUrl}</code>
              <button onClick={copyLink} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 min-h-[36px] text-xs hover:bg-muted">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
          )}

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-base text-foreground">Enhancements</h3>
              <button onClick={addAddon} className="inline-flex items-center gap-1 text-xs text-primary hover:text-accent">
                <Plus className="h-3.5 w-3.5" /> Add enhancement
              </button>
            </div>
            <div className="space-y-2">
              {addons.length === 0 && (
                <div className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  No enhancements yet.
                </div>
              )}
              {addons.map((a) => (
                <AddonRow key={a.id} addon={a} onSaved={onSaved} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddonRow({ addon, onSaved }: { addon: LbSectionAddon; onSaved: () => void }) {
  const [local, setLocal] = useState(addon);
  useEffect(() => setLocal(addon), [addon]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = (patch: Partial<LbSectionAddon>) => {
    setLocal((p) => ({ ...p, ...patch }));
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const { error } = await supabase.from("lb_section_addons").update(patch).eq("id", addon.id);
      if (error) toast.error(error.message);
      else onSaved();
    }, 400);
  };

  const remove = async () => {
    const { error } = await supabase.from("lb_section_addons").delete().eq("id", addon.id);
    if (error) toast.error(error.message);
    else onSaved();
  };

  return (
    <div className="grid grid-cols-12 items-center gap-2 rounded border border-border bg-background/60 p-2">
      <input
        className="lb-input col-span-4"
        value={local.addon_name}
        onChange={(e) => save({ addon_name: e.target.value })}
      />
      <input
        type="number"
        min={0}
        className="lb-input col-span-2"
        value={local.addon_price}
        onChange={(e) => save({ addon_price: parseFloat(e.target.value) || 0 })}
      />
      <select
        className="lb-input col-span-2"
        value={local.addon_type}
        onChange={(e) => save({ addon_type: e.target.value as LbSectionAddon["addon_type"] })}
      >
        <option value="per_stay">per stay</option>
        <option value="per_night">per night</option>
        <option value="per_person">per person</option>
      </select>
      <label className="col-span-2 flex items-center gap-1 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-[var(--primary)]"
          checked={local.is_required}
          onChange={(e) => save({ is_required: e.target.checked })}
        />
        Required
      </label>
      <label className="col-span-1 flex items-center gap-1 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-[var(--primary)]"
          checked={local.is_active}
          onChange={(e) => save({ is_active: e.target.checked })}
        />
        On
      </label>
      <button onClick={remove} className="col-span-1 inline-flex justify-end text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function LbInputStyle() {
  return (
    <style>{`
      .lb-input {
        width: 100%;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        color: var(--foreground);
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .lb-input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 15%, transparent);
      }
    `}</style>
  );
}