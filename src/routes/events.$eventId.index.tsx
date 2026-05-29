import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, Pencil, Receipt, RefreshCw, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase, type LbBooking, type LbEvent, type LbRoomSection } from "@/integrations/supabase/client";
import { AdminShell, FillBar, StatusBadge, formatDate, formatMoney } from "@/components/lb/AdminShell";
import { exportGuestManifest, exportRoomAssignments } from "@/lib/exportManifest";

export const Route = createFileRoute("/events/$eventId/")({
  component: EventDetailPage,
});

async function fetchDetail(id: string) {
  const [evt, sec, bk, gi] = await Promise.all([
    supabase.from("lb_events").select("*").eq("id", id).single(),
    supabase.from("lb_room_sections").select("*").eq("event_id", id).order("sort_order"),
    supabase.from("lb_bookings").select("*").eq("event_id", id),
    supabase.from("guest_invitations").select("section_id").eq("event_id", id),
  ]);
  if (evt.error) throw evt.error;
  return {
    event: evt.data as LbEvent,
    sections: (sec.data ?? []) as LbRoomSection[],
    bookings: (bk.data ?? []) as LbBooking[],
    invitations: (gi.data ?? []) as Array<{ section_id: string }>,
  };
}

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["lb_event_detail", eventId],
    queryFn: () => fetchDetail(eventId),
  });
  const [regenConfirm, setRegenConfirm] = useState(false);

  if (isLoading || !data) {
    return (
      <AdminShell>
        <div className="text-sm text-muted-foreground">Loading…</div>
      </AdminShell>
    );
  }

  const { event, sections, bookings, invitations } = data;
  const paidBookings = bookings.filter((b) => b.payment_status === "paid");
  const totalRevenue = paidBookings.reduce((s, b) => s + Number(b.total_amount), 0);
  const CONFIRMED_STATUSES = new Set(["paid", "deposit_paid", "covered"]);
  const isConfirmed = (b: LbBooking) =>
    CONFIRMED_STATUSES.has(b.payment_status as string) &&
    (b as LbBooking & { removed?: boolean | null }).removed !== true;
  const totalRoomsBooked = bookings.filter(isConfirmed).length;
  const totalRoomsCapacity = sections.filter((s) => s.is_active).reduce((s, x) => s + x.total_rooms, 0);
  const guestsConfirmed = bookings.filter(isConfirmed).length;
  const GUEST_CAPACITY = 40;
  const refundedCount = bookings.filter(
    (b) => (b as LbBooking & { payment_status?: string }).payment_status === "refunded",
  ).length;
  const pendingCount = bookings.filter(
    (b) => (b as LbBooking & { payment_status?: string; removed?: boolean | null }).payment_status === "pending"
      && (b as LbBooking & { removed?: boolean | null }).removed !== true,
  ).length;

  const copyLink = (slug: string | null) => {
    if (!slug) return;
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied — ready to send");
  };

  const toggleActive = async (s: LbRoomSection) => {
    const next = !s.is_active;
    const { error } = await supabase
      .from("lb_room_sections")
      .update({ is_active: next })
      .eq("id", s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Booking block activated" : "Moved back to draft");
    queryClient.invalidateQueries({ queryKey: ["lb_event_detail", eventId] });
  };

  const trackerUrl =
    typeof window !== "undefined" && (event as LbEvent & { couple_access_token?: string }).couple_access_token
      ? `${window.location.origin}/tracker/${(event as LbEvent & { couple_access_token?: string }).couple_access_token}`
      : null;

  const copyTracker = () => {
    if (!trackerUrl) return;
    navigator.clipboard.writeText(trackerUrl);
    toast.success("Tracker link copied — send this to the couple");
  };

  const regenerateToken = async () => {
    const { error } = await supabase
      .from("lb_events")
      .update({ couple_access_token: crypto.randomUUID() })
      .eq("id", eventId);
    if (error) {
      toast.error("Couldn't regenerate the link");
      return;
    }
    toast.success("New tracker link generated");
    setRegenConfirm(false);
    queryClient.invalidateQueries({ queryKey: ["lb_event_detail", eventId] });
  };

  return (
    <AdminShell>
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <Link to="/" className="text-xs uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
            ← All blocks
          </Link>
          <h1 className="mt-2 font-serif text-4xl font-medium text-foreground">{event.couple_names}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{formatDate(event.wedding_date)}</span>
            <span>·</span>
            <StatusBadge status={event.status} />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => exportGuestManifest(event, sections, bookings)}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-800 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50"
          >
            <Download className="h-4 w-4" /> Export Manifest
          </button>
          <button
            onClick={() => exportRoomAssignments(event, sections, bookings)}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-800 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50"
          >
            <Download className="h-4 w-4" /> Room Assignment Sheet
          </button>
          <Link
            to="/events/$eventId/guests"
            params={{ eventId }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            <Users className="h-4 w-4" /> Guest list
          </Link>
          <Link
            to="/events/$eventId/payments"
            params={{ eventId }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            <Receipt className="h-4 w-4" /> Payments
          </Link>
          <Link
            to="/events/$eventId/edit"
            params={{ eventId }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Pencil className="h-4 w-4" /> Edit block
          </Link>
        </div>
      </div>

      <ActivationControls
        event={event}
        sections={sections}
        invitations={invitations}
        eventId={eventId}
        onChange={() => queryClient.invalidateQueries({ queryKey: ["lb_event_detail", eventId] })}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Rooms booked" value={`${totalRoomsBooked} / ${totalRoomsCapacity || "—"}`} />
        <Stat label="Revenue collected" value={formatMoney(totalRevenue)} />
        <Stat label="Reservations" value={`${bookings.length}`} />
      </div>

      <div className="mb-10 rounded-lg border border-border bg-card px-6 py-8 text-center">
        <div className="font-serif text-5xl text-foreground">
          {guestsConfirmed} <span className="text-muted-foreground">of</span> {GUEST_CAPACITY}{" "}
          <span className="text-foreground">guests confirmed</span>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          across all four lodging sections
          {(refundedCount > 0 || pendingCount > 0) && (
            <span className="ml-2">
              · {guestsConfirmed} confirmed
              {refundedCount > 0 && ` · ${refundedCount} refunded`}
              {pendingCount > 0 && ` · ${pendingCount} pending`}
            </span>
          )}
        </div>
      </div>

      <h2 className="mb-4 font-serif text-2xl text-foreground">Sections</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((s) => {
          const filled = bookings.filter((b) => b.section_id === s.id && isConfirmed(b)).length;
          const url = s.booking_link_slug ? `${window.location.origin}/book/${s.booking_link_slug}` : null;
          return (
            <div key={s.id} className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-serif text-xl text-foreground">{s.section_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatMoney(s.price_per_night)}/night · {s.is_active ? "Active" : "Inactive"}
                  </div>
                </div>
                <span className="font-serif text-2xl tabular-nums text-foreground">
                  {filled}<span className="text-muted-foreground">/{s.total_rooms}</span>
                </span>
              </div>
              <FillBar filled={filled} total={s.total_rooms} className="mt-4" />
              {s.is_active && url && (
                <div className="mt-4 flex items-center gap-2 rounded border border-border bg-background/60 px-2.5 py-1.5">
                  <code className="flex-1 truncate text-[11px] text-muted-foreground">{url}</code>
                  <button onClick={() => copyLink(s.booking_link_slug)} className="inline-flex items-center gap-1 text-xs text-primary hover:text-accent">
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => toggleActive(s)}
                  className={`text-[11px] uppercase tracking-[0.16em] transition-colors ${
                    s.is_active
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-primary hover:text-accent"
                  }`}
                >
                  {s.is_active ? "Move to draft" : "Activate block"}
                </button>
                <Link
                  to="/events/$eventId/sections/$sectionId"
                  params={{ eventId, sectionId: s.id }}
                  className="text-xs uppercase tracking-wider text-primary hover:text-accent"
                >
                  View bookings →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-lg border border-border bg-card p-6">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Couple tracker link
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          A public, read-only page the couple can revisit to watch their guest list fill up.
        </p>
        {trackerUrl ? (
          <div className="mt-4 flex items-center gap-2 rounded border border-border bg-background/60 px-2.5 py-1.5">
            <code className="flex-1 truncate text-[11px] text-muted-foreground">{trackerUrl}</code>
            <button
              onClick={copyTracker}
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-accent"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">No tracker token on this event yet.</p>
        )}
        <div className="mt-4">
          {regenConfirm ? (
            <div className="flex items-center gap-3 rounded border border-border bg-background/60 px-3 py-2">
              <span className="text-xs text-foreground">
                The old link will stop working. Continue?
              </span>
              <button
                onClick={regenerateToken}
                className="rounded bg-primary px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-primary-foreground hover:bg-primary/90"
              >
                Regenerate
              </button>
              <button
                onClick={() => setRegenConfirm(false)}
                className="rounded border border-border px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRegenConfirm(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" /> Regenerate link
            </button>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-3xl text-foreground">{value}</div>
    </div>
  );
}

function slugifySection(name: string, eventId: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .split("-")[0] || "section";
  return `${base}-${eventId.slice(0, 8)}`;
}

function ActivationControls({
  event,
  sections,
  invitations,
  eventId,
  onChange,
}: {
  event: LbEvent;
  sections: LbRoomSection[];
  invitations: Array<{ section_id: string }>;
  eventId: string;
  onChange: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(t);
  }, [showSuccess]);

  const sectionsToActivate = sections.filter(
    (s) => (Number(s.price_per_night) || 0) > 0 || (Number(s.internal_nightly_rate) || 0) > 0,
  );
  const guestCounts = invitations.reduce<Record<string, number>>((acc, i) => {
    acc[i.section_id] = (acc[i.section_id] ?? 0) + 1;
    return acc;
  }, {});

  const check1 = sectionsToActivate.length > 0;
  const check2 =
    sectionsToActivate.length > 0 && sectionsToActivate.every((s) => (guestCounts[s.id] ?? 0) >= 1);
  const check3 = !!event.check_in_date && !!event.check_out_date;
  const allPass = check1 && check2 && check3;

  const activate = async () => {
    setBusy(true);
    try {
      const eventPatch: Partial<LbEvent> & { couple_access_token?: string } = { status: "active" };
      if (!(event as LbEvent & { couple_access_token?: string }).couple_access_token) {
        eventPatch.couple_access_token = crypto.randomUUID();
      }
      const { error: eErr } = await supabase.from("lb_events").update(eventPatch).eq("id", eventId);
      if (eErr) throw eErr;

      for (const s of sectionsToActivate) {
        const patch: Partial<LbRoomSection> = { is_active: true };
        if (!s.booking_link_slug) {
          patch.booking_link_slug = slugifySection(s.section_name, eventId);
        }
        const { error: sErr } = await supabase.from("lb_room_sections").update(patch).eq("id", s.id);
        if (sErr) throw sErr;
      }
      setShowConfirm(false);
      setShowSuccess(true);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not activate");
    } finally {
      setBusy(false);
    }
  };

  const closeReservations = async () => {
    setBusy(true);
    try {
      const { error: eErr } = await supabase
        .from("lb_events")
        .update({ status: "closed" })
        .eq("id", eventId);
      if (eErr) throw eErr;
      const { error: sErr } = await supabase
        .from("lb_room_sections")
        .update({ is_active: false })
        .eq("event_id", eventId);
      if (sErr) throw sErr;
      setShowCloseConfirm(false);
      onChange();
      toast.success("Reservations closed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not close");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6">
      {showSuccess && (
        <div className="mb-4 rounded-lg border border-emerald-800 bg-emerald-800 px-5 py-3 text-sm font-medium text-white">
          Reservations are open.
        </div>
      )}

      {event.status === "draft" && !showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-800 px-6 py-3 text-sm font-medium uppercase tracking-wider text-white shadow-sm hover:bg-emerald-900"
        >
          Activate Block
        </button>
      )}

      {event.status === "draft" && showConfirm && (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="font-serif text-xl text-foreground">Ready to open reservations?</div>
          <ul className="mt-4 space-y-2 text-sm">
            <CheckItem ok={check1} label="All active sections have a nightly rate set" />
            <CheckItem ok={check2} label="All active sections have at least 1 guest on the list" />
            <CheckItem ok={check3} label="Check-in and check-out dates are set" />
          </ul>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={activate}
              disabled={!allPass || busy}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-800 px-5 py-2.5 text-sm font-medium uppercase tracking-wider text-white hover:bg-emerald-900 disabled:opacity-40"
            >
              {busy ? "Activating…" : "Activate — Open Reservations"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Not yet
            </button>
          </div>
        </div>
      )}

      {event.status === "active" && !showCloseConfirm && (
        <button
          onClick={() => setShowCloseConfirm(true)}
          className="inline-flex items-center gap-2 rounded-full border border-red-600 px-5 py-2.5 text-sm font-medium uppercase tracking-wider text-red-600 hover:bg-red-50"
        >
          Close Reservations
        </button>
      )}

      {event.status === "active" && showCloseConfirm && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-6">
          <div className="font-serif text-lg text-foreground">Close reservations?</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Guests with existing bookings will not be affected. New bookings will be blocked.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={closeReservations}
              disabled={busy}
              className="rounded-full border border-red-600 bg-red-600 px-5 py-2 text-sm font-medium uppercase tracking-wider text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? "Closing…" : "Close reservations"}
            </button>
            <button
              onClick={() => setShowCloseConfirm(false)}
              className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-foreground" : "text-red-600"}`}>
      {ok ? <Check className="h-4 w-4 text-emerald-700" /> : <X className="h-4 w-4 text-red-600" />}
      <span>{label}</span>
    </li>
  );
}