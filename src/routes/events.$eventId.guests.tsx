import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  supabase,
  type GuestInvitation,
  type LbEvent,
  type LbRoomSection,
} from "@/integrations/supabase/client";
import { AdminShell } from "@/components/lb/AdminShell";
import { EventLayout } from "@/components/lb/EventNav";

export const Route = createFileRoute("/events/$eventId/guests")({
  component: GuestsPage,
});

const inviteSchema = z.object({
  guest_name: z.string().trim().min(1, "Name is required").max(120),
  guest_email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  section_id: z.string().uuid("Choose a section"),
  invite_group: z.string().trim().min(1).max(60),
  room_allocation: z.number().int().min(1).max(5),
  secondary_booking_for: z.string().trim().max(200).optional().nullable(),
});

type InviteForm = z.infer<typeof inviteSchema>;

async function fetchAll(eventId: string) {
  const [evt, sec, inv] = await Promise.all([
    supabase.from("lb_events").select("*").eq("id", eventId).single(),
    supabase.from("lb_room_sections").select("*").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("guest_invitations")
      .select("*")
      .eq("event_id", eventId)
      .order("invite_group")
      .order("guest_name"),
  ]);
  if (evt.error) throw evt.error;
  return {
    event: evt.data as LbEvent,
    sections: (sec.data ?? []) as LbRoomSection[],
    invitations: (inv.data ?? []) as GuestInvitation[],
  };
}

function GuestsPage() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["guest_invitations_page", eventId],
    queryFn: () => fetchAll(eventId),
  });

  const upsert = useMutation({
    mutationFn: async (input: InviteForm & { id?: string }) => {
      const parsed = inviteSchema.parse(input);
      const payload = {
        event_id: eventId,
        guest_name: parsed.guest_name,
        guest_email: parsed.guest_email,
        section_id: parsed.section_id,
        invite_group: parsed.invite_group,
        room_allocation: parsed.room_allocation,
        secondary_booking_for: parsed.secondary_booking_for || null,
      };
      if (input.id) {
        const { error } = await supabase
          .from("guest_invitations")
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("guest_invitations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guest_invitations_page", eventId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Could not save invitation";
      if (msg.includes("guest_invitations_unique_per_event")) {
        toast.error("That email is already on this event's guest list.");
      } else {
        toast.error(msg);
      }
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("guest_invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guest_invitations_page", eventId] });
      toast.success("Invitation removed");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove"),
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

  const { event, sections, invitations } = data;
  const activeSections = sections.filter((s) => s.is_active);
  const totalInvited = invitations.length;
  const totalBooked = invitations.reduce((s, i) => s + i.rooms_booked, 0);
  const totalAllocated = invitations.reduce((s, i) => s + i.room_allocation, 0);

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
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Add the email address for each guest invited to book a room. Only invited guests can
          access the private booking link for this block.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Invited" value={String(totalInvited)} />
        <Stat label="Rooms allocated" value={String(totalAllocated)} />
        <Stat label="Rooms booked" value={String(totalBooked)} />
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
        <GuestList
          invitations={invitations}
          sections={sections}
          onSave={(form, id) => upsert.mutateAsync({ ...form, id })}
          onRemove={(id) => remove.mutate(id)}
          saving={upsert.isPending}
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

function GuestList({
  invitations,
  sections,
  onSave,
  onRemove,
  saving,
}: {
  invitations: GuestInvitation[];
  sections: LbRoomSection[];
  onSave: (form: InviteForm, id?: string) => Promise<void>;
  onRemove: (id: string) => void;
  saving: boolean;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, GuestInvitation[]>();
    const order = ["Bridal Party", "Family", "Friends", "Plus-Ones", "Guests"];
    for (const inv of invitations) {
      const key = inv.invite_group || "Guests";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inv);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return keys.map((k) => ({ name: k, invites: map.get(k)! }));
  }, [invitations]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);

  const isOpen = (g: string) => open[g] !== false;

  const sectionName = (id: string) =>
    sections.find((s) => s.id === id)?.section_name ?? "Unknown section";

  return (
    <div className="space-y-4">
      {groups.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm text-foreground">No guests invited yet. Add the first one below.</p>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.name} className="rounded-lg border border-border bg-card">
          <button
            onClick={() => setOpen((o) => ({ ...o, [g.name]: !isOpen(g.name) }))}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              {isOpen(g.name) ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-serif text-xl text-foreground">{g.name}</span>
              <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {g.invites.length} invited
              </span>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setAdding(g.name);
                setOpen((o) => ({ ...o, [g.name]: true }));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  setAdding(g.name);
                }
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
            >
              <Plus className="h-3 w-3" /> Add guest
            </span>
          </button>

          {isOpen(g.name) && (
            <div className="divide-y divide-border border-t border-border">
              {g.invites.map((inv) => (
                <InviteRow
                  key={inv.id}
                  invite={inv}
                  sections={sections}
                  sectionName={sectionName(inv.section_id)}
                  onSave={onSave}
                  onRemove={onRemove}
                  saving={saving}
                />
              ))}
              {adding === g.name && (
                <NewInviteRow
                  groupName={g.name}
                  sections={sections}
                  saving={saving}
                  onCancel={() => setAdding(null)}
                  onSave={async (form) => {
                    await onSave(form);
                    setAdding(null);
                  }}
                />
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add a new group */}
      <NewGroupAdder
        sections={sections}
        existingGroups={groups.map((g) => g.name)}
        saving={saving}
        onSave={onSave}
      />
    </div>
  );
}

function InviteRow({
  invite,
  sections,
  sectionName,
  onSave,
  onRemove,
  saving,
}: {
  invite: GuestInvitation;
  sections: LbRoomSection[];
  sectionName: string;
  onSave: (form: InviteForm, id?: string) => Promise<void>;
  onRemove: (id: string) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const status = invite.rooms_booked > 0 ? "booked" : invite.last_accessed_at ? "viewed" : "invited";
  const dot =
    status === "booked"
      ? "bg-primary"
      : status === "viewed"
        ? "bg-accent"
        : "bg-muted-foreground/40";

  if (editing) {
    return (
      <NewInviteRow
        groupName={invite.invite_group}
        sections={sections}
        saving={saving}
        initial={{
          guest_name: invite.guest_name,
          guest_email: invite.guest_email,
          section_id: invite.section_id,
          invite_group: invite.invite_group,
          room_allocation: invite.room_allocation,
          secondary_booking_for: invite.secondary_booking_for ?? "",
        }}
        onCancel={() => setEditing(false)}
        onSave={async (form) => {
          await onSave(form, invite.id);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="group flex items-center gap-4 px-5 py-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-medium text-foreground">{invite.guest_name}</span>
          <span className="truncate text-xs text-muted-foreground">{invite.guest_email}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>{sectionName}</span>
          <span>·</span>
          <span>
            {invite.rooms_booked}/{invite.room_allocation} rooms
          </span>
          {invite.secondary_booking_for && (
            <>
              <span>·</span>
              <span className="normal-case tracking-normal text-muted-foreground">
                Extra room for: {invite.secondary_booking_for}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={() => setEditing(true)}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            if (invite.rooms_booked > 0) {
              if (
                !confirm(
                  "This guest has already booked a room. Removing the invitation revokes future access but does not cancel completed bookings. Continue?",
                )
              )
                return;
            }
            onRemove(invite.id);
          }}
          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function NewInviteRow({
  groupName,
  sections,
  saving,
  onSave,
  onCancel,
  initial,
}: {
  groupName: string;
  sections: LbRoomSection[];
  saving: boolean;
  onSave: (form: InviteForm) => Promise<void>;
  onCancel: () => void;
  initial?: Partial<InviteForm> & { secondary_booking_for?: string };
}) {
  const activeSections = sections.filter((s) => s.is_active);
  const [form, setForm] = useState<InviteForm>({
    guest_name: initial?.guest_name ?? "",
    guest_email: initial?.guest_email ?? "",
    section_id: initial?.section_id ?? activeSections[0]?.id ?? "",
    invite_group: initial?.invite_group ?? groupName,
    room_allocation: initial?.room_allocation ?? 1,
    secondary_booking_for: initial?.secondary_booking_for ?? "",
  });

  const submit = async () => {
    const result = inviteSchema.safeParse({
      ...form,
      secondary_booking_for: form.secondary_booking_for || null,
    });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Check the form");
      return;
    }
    await onSave(result.data);
  };

  return (
    <div className="bg-background/50 px-5 py-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <Field label="Name" className="md:col-span-3">
          <input
            value={form.guest_name}
            onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
            placeholder="Jane Doe"
          />
        </Field>
        <Field label="Email" className="md:col-span-3">
          <input
            type="email"
            value={form.guest_email}
            onChange={(e) => setForm({ ...form, guest_email: e.target.value })}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
            placeholder="jane@email.com"
          />
        </Field>
        <Field label="Section" className="md:col-span-3">
          <select
            value={form.section_id}
            onChange={(e) => setForm({ ...form, section_id: e.target.value })}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
          >
            {activeSections.length === 0 && <option value="">No active sections</option>}
            {activeSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.section_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rooms allowed" className="md:col-span-3">
          <select
            value={form.room_allocation}
            onChange={(e) => setForm({ ...form, room_allocation: Number(e.target.value) })}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        {form.room_allocation > 1 && (
          <Field label="Who is the additional room for?" className="md:col-span-12">
            <input
              value={form.secondary_booking_for ?? ""}
              onChange={(e) => setForm({ ...form, secondary_booking_for: e.target.value })}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
              placeholder="e.g. Their kids, Their parents"
            />
          </Field>
        )}
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
          {saving ? "Saving…" : initial ? "Save changes" : "Add to list"}
        </button>
      </div>
    </div>
  );
}

function NewGroupAdder({
  sections,
  existingGroups,
  saving,
  onSave,
}: {
  sections: LbRoomSection[];
  existingGroups: string[];
  saving: boolean;
  onSave: (form: InviteForm, id?: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-dashed border-border bg-transparent px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> New group
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Group name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. College Friends"
            className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <button
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) {
              toast.error("Give the group a name");
              return;
            }
            if (existingGroups.includes(trimmed)) {
              toast.error("That group already exists");
              return;
            }
            // Seed an empty placeholder by opening the new-invite row in that group:
            // simplest path is to create the group by adding the first guest via the
            // section's "Add guest" button. So we just close and rely on user to add.
            toast.info(`Add a guest under "${trimmed}" using its Add guest button.`);
            setOpen(false);
            setName("");
          }}
          disabled={saving || sections.filter((s) => s.is_active).length === 0}
          className="rounded-full bg-primary px-4 py-1.5 text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Continue
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setName("");
          }}
          className="rounded-full border border-border px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Hint: a group appears once you add the first guest to it. You can also type any group name
        directly when editing a guest.
      </p>
      {/* Inline first-guest creation for the brand new group */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Or add the first guest to "{name || "—"}" right now:
        </p>
        <NewInviteRow
          groupName={name || "Guests"}
          sections={sections}
          saving={saving}
          onCancel={() => {
            setOpen(false);
            setName("");
          }}
          onSave={async (form) => {
            await onSave({ ...form, invite_group: name.trim() || form.invite_group });
            setOpen(false);
            setName("");
          }}
        />
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