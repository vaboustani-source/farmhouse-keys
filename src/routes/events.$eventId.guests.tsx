import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, Mail, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  supabase,
  type LbEvent,
  type LbRoomSection,
} from "@/integrations/supabase/client";
import { AdminShell } from "@/components/lb/AdminShell";
import { EventLayout } from "@/components/lb/EventNav";
import {
  sendBookingInvitation,
  sendSectionPendingInvitations,
} from "@/lib/invitations.functions";

export const Route = createFileRoute("/events/$eventId/guests")({
  component: GuestsPage,
});

const newBookingSchema = z.object({
  guest_name: z.string().trim().min(1, "Name is required").max(120),
  guest_email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  section_id: z.string().uuid("Choose a section"),
});

type NewBookingForm = z.infer<typeof newBookingSchema>;

type BookingRow = {
  id: string;
  guest_name: string;
  guest_email: string;
  payment_status: string;
  section_id: string;
  total_amount: number | null;
  deposit_paid_at: string | null;
  final_paid_at: string | null;
  booked_at: string | null;
  room_assignment: string | null;
  cot_requested: boolean | null;
  removed: boolean | null;
  invitation_sent_at: string | null;
  invitation_count: number | null;
};

async function fetchAll(eventId: string) {
  const [evt, sec, bk] = await Promise.all([
    supabase.from("lb_events").select("*").eq("id", eventId).single(),
    supabase.from("lb_room_sections").select("*").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("lb_bookings")
      .select(
        "id, guest_name, guest_email, payment_status, section_id, total_amount, deposit_paid_at, final_paid_at, booked_at, room_assignment, cot_requested, removed, invitation_sent_at, invitation_count",
      )
      .eq("event_id", eventId)
      .neq("removed", true)
      .order("guest_name"),
  ]);
  if (evt.error) throw evt.error;
  return {
    event: evt.data as LbEvent,
    sections: (sec.data ?? []) as LbRoomSection[],
    bookings: (bk.data ?? []) as BookingRow[],
  };
}

function GuestsPage() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["guest_bookings_page", eventId],
    queryFn: () => fetchAll(eventId),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["guest_bookings_page", eventId] });

  const sendOne = useServerFn(sendBookingInvitation);
  const sendSection = useServerFn(sendSectionPendingInvitations);

  const createBooking = useMutation({
    mutationFn: async (input: NewBookingForm) => {
      const parsed = newBookingSchema.parse(input);
      const { error } = await supabase.from("lb_bookings").insert({
        event_id: eventId,
        section_id: parsed.section_id,
        guest_name: parsed.guest_name,
        guest_email: parsed.guest_email,
        payment_status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Guest added");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not add guest"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lb_bookings")
        .update({ removed: true, removed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Guest removed");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not remove"),
  });

  const updateRoom = useMutation({
    mutationFn: async ({ id, room }: { id: string; room: string }) => {
      const { error } = await supabase
        .from("lb_bookings")
        .update({ room_assignment: room || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update room"),
  });

  const sendInvite = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await sendOne({ data: { bookingId } });
      if (!res.ok) throw new Error(res.reason);
      return res;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Invitation sent");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not send"),
  });

  const sendSectionInvites = useMutation({
    mutationFn: async (sectionId: string) => {
      return await sendSection({ data: { eventId, sectionId } });
    },
    onSuccess: (res) => {
      invalidate();
      if (res.total === 0) toast.info("No pending guests to send to.");
      else toast.success(`Sent ${res.sent} / ${res.total} invitations`);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not send"),
  });

  if (isLoading || !data) {
    return (
      <AdminShell>
        <EventLayout eventId={eventId} currentTab="guests">
          <div className="text-sm text-muted-foreground">Loading…</div>
        </EventLayout>
      </AdminShell>
    );
  }

  const { event, sections, bookings } = data;
  const activeSections = sections.filter((s) => s.is_active);
  const totalInvited = bookings.length;
  const totalAllocated = bookings.length;
  const totalBooked = bookings.filter((b) =>
    ["paid", "deposit_paid", "covered"].includes(b.payment_status),
  ).length;
  const totalPaidFull = bookings.filter((b) => b.payment_status === "paid").length;

  return (
    <AdminShell>
      <EventLayout eventId={eventId} currentTab="guests">
        <div className="mb-6">
          <Link
            to="/events/$eventId"
            params={{ eventId }}
            className="text-xs uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
          >
            ← Back to {event.couple_names}
          </Link>
          <h1 className="mt-2 font-serif text-4xl font-medium text-foreground">
            Guest Lodging Invitations
          </h1>
          <p
            className="mt-2 max-w-2xl italic"
            style={{
              fontFamily: "'Jost', ui-sans-serif, system-ui, sans-serif",
              fontSize: 13,
              color: "#9A9188",
            }}
          >
            Guest list syncs automatically from the Planning Hub. Add guests here only for last-minute additions.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Invited" value={String(totalInvited)} />
          <Stat label="Rooms allocated" value={String(totalAllocated)} />
          <Stat label="Rooms booked" value={String(totalBooked)} />
          <Stat label="Paid in full" value={String(totalPaidFull)} />
        </div>

        {activeSections.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-foreground">
              Activate at least one room section before inviting guests.
            </p>
            <Link
              to="/events/$eventId/edit"
              params={{ eventId }}
              className="mt-4 inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
            >
              Edit block
            </Link>
          </div>
        ) : (
          <BookingList
            bookings={bookings}
            sections={sections}
            onAdd={(form) => createBooking.mutateAsync(form)}
            onRemove={(id) => remove.mutate(id)}
            onUpdateRoom={(id, room) => updateRoom.mutate({ id, room })}
            onSendInvite={(id) => sendInvite.mutate(id)}
            onSendSection={(sectionId) => {
              if (confirm("Send booking links to all pending guests in this section?")) {
                sendSectionInvites.mutate(sectionId);
              }
            }}
            saving={createBooking.isPending}
            sendingId={sendInvite.isPending ? sendInvite.variables ?? null : null}
          />
        )}
      </EventLayout>
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

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function paidAmount(b: BookingRow): number {
  const total = Number(b.total_amount) || 0;
  if (b.payment_status === "paid" || b.payment_status === "covered") return total;
  if (b.payment_status === "deposit_paid") return total / 2;
  return 0;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: "#EDE9E2", fg: "#6B6359", label: "Awaiting" },
    deposit_paid: { bg: "#FBF6E7", fg: "#7a6420", label: "Deposit paid" },
    paid: { bg: "#E4EDE0", fg: "#2C3E2D", label: "Paid in full" },
    covered: { bg: "#E4EDE0", fg: "#2C3E2D", label: "Covered" },
    payment_failed: { bg: "#FDF3F0", fg: "#C0392B", label: "Payment failed" },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function BookingList({
  bookings,
  sections,
  onAdd,
  onRemove,
  onUpdateRoom,
  onSendInvite,
  onSendSection,
  saving,
  sendingId,
}: {
  bookings: BookingRow[];
  sections: LbRoomSection[];
  onAdd: (form: NewBookingForm) => Promise<void>;
  onRemove: (id: string) => void;
  onUpdateRoom: (id: string, room: string) => void;
  onSendInvite: (id: string) => void;
  onSendSection: (sectionId: string) => void;
  saving: boolean;
  sendingId: string | null;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const b of bookings) {
      if (!map.has(b.section_id)) map.set(b.section_id, []);
      map.get(b.section_id)!.push(b);
    }
    return sections
      .filter((s) => s.is_active || map.has(s.id))
      .map((s) => ({ section: s, rows: map.get(s.id) ?? [] }));
  }, [bookings, sections]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const isOpen = (id: string) => open[id] !== false;

  return (
    <div className="space-y-4">
      {grouped.map(({ section, rows }) => {
        const booked = rows.filter((r) =>
          ["paid", "deposit_paid", "covered"].includes(r.payment_status),
        ).length;
        const paidFull = rows.filter((r) => r.payment_status === "paid").length;
        const capacity = section.total_rooms ?? rows.length;
        return (
          <div key={section.id} className="rounded-lg border border-border bg-card">
            <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
              <button
                onClick={() => setOpen((o) => ({ ...o, [section.id]: !isOpen(section.id) }))}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left"
              >
                {isOpen(section.id) ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="font-serif text-xl text-foreground break-words">{section.section_name}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {rows.length}/{capacity} invited · {booked} booked · {paidFull} paid in full
                </span>
              </button>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <button
                  onClick={() => onSendSection(section.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 min-h-[36px] text-xs text-foreground hover:bg-muted"
                >
                  <Mail className="h-3 w-3" /> Send to all pending
                </button>
                <button
                  onClick={() => {
                    setAdding(section.id);
                    setOpen((o) => ({ ...o, [section.id]: true }));
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 min-h-[36px] text-xs text-foreground hover:bg-muted"
                >
                  <Plus className="h-3 w-3" /> Add guest
                </button>
              </div>
            </div>

            {isOpen(section.id) && (
              <div className="divide-y divide-border border-t border-border">
                {rows.length === 0 && adding !== section.id && (
                  <div className="px-5 py-4 text-sm text-muted-foreground">
                    No guests in this section yet.
                  </div>
                )}
                {rows.map((b) => (
                  <BookingRowView
                    key={b.id}
                    booking={b}
                    onRemove={onRemove}
                    onUpdateRoom={onUpdateRoom}
                    onSendInvite={onSendInvite}
                    sending={sendingId === b.id}
                  />
                ))}
                {adding === section.id && (
                  <NewBookingRow
                    sectionId={section.id}
                    sections={sections}
                    saving={saving}
                    onCancel={() => setAdding(null)}
                    onSave={async (form) => {
                      await onAdd(form);
                      setAdding(null);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BookingRowView({
  booking,
  onRemove,
  onUpdateRoom,
  onSendInvite,
  sending,
}: {
  booking: BookingRow;
  onRemove: (id: string) => void;
  onUpdateRoom: (id: string, room: string) => void;
  onSendInvite: (id: string) => void;
  sending: boolean;
}) {
  const [room, setRoom] = useState(booking.room_assignment ?? "");
  const paid = paidAmount(booking);
  const total = Number(booking.total_amount) || 0;
  const sentAt = booking.invitation_sent_at
    ? new Date(booking.invitation_sent_at).toLocaleString()
    : null;

  return (
    <div className="group flex flex-wrap items-center gap-4 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-medium text-foreground">{booking.guest_name}</span>
          <span className="truncate text-xs text-muted-foreground">{booking.guest_email}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge status={booking.payment_status} />
          {total > 0 && (
            <span className="tabular-nums">
              {fmtMoney(paid)} / {fmtMoney(total)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          onBlur={() => {
            if ((booking.room_assignment ?? "") !== room) onUpdateRoom(booking.id, room);
          }}
          placeholder="Room"
          className="w-24 rounded border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
        />
        <button
          onClick={() => onSendInvite(booking.id)}
          disabled={sending}
          title={sentAt ? `Last sent ${sentAt}` : undefined}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 min-h-[36px] text-xs text-foreground hover:bg-muted disabled:opacity-50"
        >
          <Mail className="h-3 w-3" />
          {sending ? "Sending…" : booking.invitation_sent_at ? "Sent ✓" : "Send link"}
        </button>
        <button
          onClick={() => {
            if (
              ["paid", "deposit_paid", "covered"].includes(booking.payment_status)
            ) {
              if (
                !confirm(
                  "This guest has already paid. Removing the booking marks it removed but does not refund. Continue?",
                )
              )
                return;
            }
            onRemove(booking.id);
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function NewBookingRow({
  sectionId,
  sections,
  saving,
  onSave,
  onCancel,
}: {
  sectionId: string;
  sections: LbRoomSection[];
  saving: boolean;
  onSave: (form: NewBookingForm) => Promise<void>;
  onCancel: () => void;
}) {
  const activeSections = sections.filter((s) => s.is_active);
  const [form, setForm] = useState<NewBookingForm>({
    guest_name: "",
    guest_email: "",
    section_id: sectionId,
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [nameFocus, setNameFocus] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [flash, setFlash] = useState(false);

  const isEmailValid = (v: string) => {
    const s = v.trim();
    if (s.length < 5) return false;
    const at = s.indexOf("@");
    if (at <= 0) return false;
    const dot = s.indexOf(".", at + 1);
    return dot > at + 1 && dot < s.length - 1;
  };
  const isNameValid = (v: string) => v.trim().length >= 2;

  const submit = async () => {
    const nameOk = isNameValid(form.guest_name);
    const emailOk = isEmailValid(form.guest_email);
    setNameError(nameOk ? null : "Enter a valid name");
    setEmailError(emailOk ? null : "Enter a valid email");
    if (!nameOk || !emailOk) return;
    const result = newBookingSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Check the form");
      return;
    }
    await onSave(result.data);
    setFlash(true);
    setTimeout(() => setFlash(false), 800);
  };

  const rowBorder = flash
    ? "border-l-4 border-l-emerald-500"
    : nameFocus || emailFocus
      ? "border-l-4 border-l-yellow-400"
      : "border-l-4 border-l-transparent";

  return (
    <div className={`bg-background/50 px-5 py-4 transition-colors ${rowBorder}`}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <Field label="Name" className="md:col-span-4">
          <input
            value={form.guest_name}
            onChange={(e) => {
              setForm({ ...form, guest_name: e.target.value });
              if (nameError) setNameError(null);
            }}
            onFocus={() => setNameFocus(true)}
            onBlur={() => {
              setNameFocus(false);
              setNameError(isNameValid(form.guest_name) ? null : "Enter a valid name");
            }}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
            placeholder="Jane Doe"
          />
          {nameError && (
            <span className="mt-1 block text-[11px] text-red-600">{nameError}</span>
          )}
        </Field>
        <Field label="Email" className="md:col-span-4">
          <input
            type="email"
            value={form.guest_email}
            onChange={(e) => {
              setForm({ ...form, guest_email: e.target.value });
              if (emailError) setEmailError(null);
            }}
            onFocus={() => setEmailFocus(true)}
            onBlur={() => {
              setEmailFocus(false);
              setEmailError(isEmailValid(form.guest_email) ? null : "Enter a valid email");
            }}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
            placeholder="jane@email.com"
          />
          {emailError && (
            <span className="mt-1 block text-[11px] text-red-600">{emailError}</span>
          )}
        </Field>
        <Field label="Section" className="md:col-span-4">
          <select
            value={form.section_id}
            onChange={(e) => setForm({ ...form, section_id: e.target.value })}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
          >
            {activeSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.section_name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-full border border-border px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-full bg-primary px-4 py-1.5 text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add guest"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}