import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/lb/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import {
  updatePopupTier,
  savePopupItinerary,
  updatePopupEventDetails,
} from "@/lib/popup-admin.functions";
import { toast } from "sonner";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/events/$eventId/tiers")({
  component: TiersPage,
});

/* Minimal untyped query surface for popup-only columns/tables that are
   newer than the generated Database types. */
type UntypedClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type TierRow = {
  id: string;
  section_name: string;
  tagline: string | null;
  regular_package_price: number | null;
  promo_package_price: number | null;
  promo_active: boolean;
  total_rooms: number;
  nights: number;
  is_active: boolean;
  sort_order: number;
};

type ItineraryRowT = {
  id?: string;
  day_number: number;
  time_label: string | null;
  activity: string;
  note: string | null;
  tier1_included: boolean;
  tier2_included: boolean;
  tier3_included: boolean;
};

async function fetchTiersData(eventId: string) {
  const [{ data: event }, { data: sections }, { data: itinerary }] = await Promise.all([
    supabase
      .from("lb_events")
      .select("id, wedding_name, slug, status, check_in_date, check_out_date, nights")
      .eq("id", eventId)
      .single(),
    supabase
      .from("lb_room_sections")
      .select("id, section_name, total_rooms, nights, is_active, sort_order")
      .eq("event_id", eventId)
      .order("sort_order"),
    // Popup-only columns aren't in the generated types yet — fetch raw.
    (supabase as unknown as UntypedClient)
      .from("lb_itinerary_items")
      .select("*")
      .eq("event_id", eventId)
      .order("day_number")
      .order("sort_order"),
  ]);
  // Second pass for popup columns on sections + hero intro (untyped select).
  const { data: rawSections } = await (supabase as unknown as UntypedClient)
    .from("lb_room_sections")
    .select("id, tagline, regular_package_price, promo_package_price, promo_active")
    .eq("event_id", eventId);
  const { data: rawEvent } = await (supabase as unknown as UntypedClient)
    .from("lb_events")
    .select("hero_intro, event_type")
    .eq("id", eventId)
    .single();

  const merged: TierRow[] = (sections ?? []).map((s) => {
    const extra = (rawSections ?? []).find((r: { id: string }) => r.id === s.id) ?? {};
    return {
      ...s,
      tagline: extra.tagline ?? null,
      regular_package_price:
        extra.regular_package_price == null ? null : Number(extra.regular_package_price),
      promo_package_price:
        extra.promo_package_price == null ? null : Number(extra.promo_package_price),
      promo_active: !!extra.promo_active,
    } as TierRow;
  });

  return {
    event: event
      ? {
          ...event,
          hero_intro: rawEvent?.hero_intro ?? null,
          event_type: rawEvent?.event_type ?? "wedding",
        }
      : null,
    tiers: merged,
    itinerary: (itinerary ?? []) as (ItineraryRowT & { id: string })[],
  };
}

function TiersPage() {
  const { eventId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["popup_tiers", eventId],
    queryFn: () => fetchTiersData(eventId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["popup_tiers", eventId] });

  return (
    <AdminShell>
      <div className="mx-auto max-w-4xl">
        <Link
          to="/events/$eventId"
          params={{ eventId }}
          className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
        >
          ← Event overview
        </Link>

        {isLoading || !data?.event ? (
          <div className="mt-10 rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            One moment…
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-serif text-4xl font-medium text-foreground">
                  {data.event.wedding_name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tiers &amp; itinerary · {data.event.check_in_date} → {data.event.check_out_date}
                </p>
              </div>
              <PublicLink slug={data.event.slug} status={data.event.status} />
            </div>

            <HeroIntroEditor
              eventId={eventId}
              initial={data.event.hero_intro ?? ""}
              onSaved={invalidate}
            />

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {data.tiers.map((t) => (
                <TierEditor key={t.id} tier={t} onSaved={invalidate} />
              ))}
            </div>

            <ItineraryEditor
              eventId={eventId}
              tierNames={data.tiers.map((t) => t.section_name)}
              initial={data.itinerary}
              onSaved={invalidate}
            />
          </>
        )}
      </div>
    </AdminShell>
  );
}

function PublicLink({ slug, status }: { slug: string | null; status: string }) {
  if (!slug) return null;
  const url = `https://stay.gilbertsvillefarmhouse.com/stay/${slug}`;
  return (
    <div className="flex items-center gap-2">
      {status !== "active" && (
        <span className="rounded-full bg-muted px-3 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          {status} — activate on the overview page to open reservations
        </span>
      )}
      <button
        onClick={() => {
          navigator.clipboard.writeText(url);
          toast.success("Link copied — ready to share");
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
      >
        <Copy className="h-3.5 w-3.5" /> Copy public link
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
      >
        <ExternalLink className="h-3.5 w-3.5" /> View
      </a>
    </div>
  );
}

function HeroIntroEditor({
  eventId,
  initial,
  onSaved,
}: {
  eventId: string;
  initial: string;
  onSaved: () => void;
}) {
  const save = useServerFn(updatePopupEventDetails);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(initial), [initial]);

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-foreground">Landing page intro</h2>
        <button
          disabled={saving || value === initial}
          onClick={async () => {
            setSaving(true);
            try {
              await save({ data: { eventId, heroIntro: value || null } });
              toast.success("Intro saved");
              onSaved();
            } catch {
              toast.error("Could not save");
            } finally {
              setSaving(false);
            }
          }}
          className="rounded bg-primary px-4 py-1.5 text-xs uppercase tracking-[0.16em] text-primary-foreground disabled:opacity-40"
        >
          Save
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="One warm paragraph welcoming guests to the weekend."
        className="mt-3 w-full rounded border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function TierEditor({ tier, onSaved }: { tier: TierRow; onSaved: () => void }) {
  const save = useServerFn(updatePopupTier);
  const [name, setName] = useState(tier.section_name);
  const [tagline, setTagline] = useState(tier.tagline ?? "");
  const [regular, setRegular] = useState(String(tier.regular_package_price ?? ""));
  const [promo, setPromo] = useState(String(tier.promo_package_price ?? ""));
  const [promoActive, setPromoActive] = useState(tier.promo_active);
  const [rooms, setRooms] = useState(String(tier.total_rooms));
  const [active, setActive] = useState(tier.is_active);
  const [saving, setSaving] = useState(false);

  const selling = promoActive && promo !== "" ? Number(promo) : Number(regular || 0);

  const submit = async () => {
    setSaving(true);
    try {
      await save({
        data: {
          sectionId: tier.id,
          sectionName: name.trim(),
          tagline: tagline.trim() || null,
          regularPackagePrice: Number(regular || 0),
          promoPackagePrice: promo === "" ? null : Number(promo),
          promoActive,
          totalRooms: Number(rooms || 0),
          isActive: active,
        },
      });
      toast.success(`${name} saved — selling at $${selling.toLocaleString()}`);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Could not save tier");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`rounded-lg border bg-card p-5 ${active ? "border-border" : "border-dashed border-border opacity-70"}`}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border-0 bg-transparent p-0 font-serif text-xl text-foreground focus:outline-none"
      />
      <input
        value={tagline}
        onChange={(e) => setTagline(e.target.value)}
        placeholder="Tagline"
        className="mt-1 w-full border-0 bg-transparent p-0 text-xs italic text-muted-foreground focus:outline-none"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <PriceField label="Regular" value={regular} onChange={setRegular} />
        <PriceField label="Promo" value={promo} onChange={setPromo} />
      </div>

      <label className="mt-3 flex cursor-pointer items-center justify-between text-sm text-foreground">
        <span>Promo rate live</span>
        <input
          type="checkbox"
          checked={promoActive}
          onChange={(e) => setPromoActive(e.target.checked)}
          className="h-5 w-5 accent-[#2C3E2D]"
        />
      </label>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Rooms</span>
        <input
          type="number"
          min={0}
          max={40}
          value={rooms}
          onChange={(e) => setRooms(e.target.value)}
          className="w-20 rounded border border-border bg-background px-2 py-1 text-right text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <label className="mt-3 flex cursor-pointer items-center justify-between text-sm text-foreground">
        <span>Tier on sale</span>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-5 w-5 accent-[#2C3E2D]"
        />
      </label>

      <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        Guests pay <span className="font-medium text-foreground">${selling.toLocaleString()}</span>{" "}
        per couple (+ fees &amp; tax)
      </div>

      <button
        onClick={submit}
        disabled={saving}
        className="mt-3 w-full rounded bg-primary px-4 py-2 text-xs uppercase tracking-[0.16em] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save tier"}
      </button>
    </div>
  );
}

function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </label>
      <div className="mt-1 flex items-center rounded border border-border bg-background px-2">
        <span className="text-sm text-muted-foreground">$</span>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-1 py-1.5 text-sm text-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}

/* ── Itinerary editor: the spreadsheet, in app form ── */

function ItineraryEditor({
  eventId,
  tierNames,
  initial,
  onSaved,
}: {
  eventId: string;
  tierNames: string[];
  initial: (ItineraryRowT & { id: string })[];
  onSaved: () => void;
}) {
  const save = useServerFn(savePopupItinerary);
  const [rows, setRows] = useState<ItineraryRowT[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(initial);
    setDirty(false);
  }, [initial]);

  const update = (idx: number, patch: Partial<ItineraryRowT>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      await save({
        data: {
          eventId,
          items: rows.map((r) => ({
            dayNumber: r.day_number,
            timeLabel: r.time_label?.trim() ? r.time_label.trim() : null,
            activity: r.activity.trim(),
            note: r.note?.trim() ? r.note.trim() : null,
            tier1: r.tier1_included,
            tier2: r.tier2_included,
            tier3: r.tier3_included,
          })),
        },
      });
      toast.success("Itinerary saved");
      setDirty(false);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Could not save itinerary");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-10 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Itinerary</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Check which tiers include each moment — the public page and tier cards update from this
            table.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const lastDay = rows.length ? rows[rows.length - 1].day_number : 1;
              setRows((prev) => [
                ...prev,
                {
                  day_number: lastDay,
                  time_label: "",
                  activity: "",
                  note: null,
                  tier1_included: true,
                  tier2_included: true,
                  tier3_included: true,
                },
              ]);
              setDirty(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Add moment
          </button>
          <button
            onClick={submit}
            disabled={saving || !dirty}
            className="rounded bg-primary px-4 py-1.5 text-xs uppercase tracking-[0.16em] text-primary-foreground disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save itinerary"}
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-2 pr-2 font-medium">Day</th>
              <th className="py-2 pr-2 font-medium">Time</th>
              <th className="py-2 pr-2 font-medium">Activity</th>
              <th className="py-2 pr-2 font-medium">Note</th>
              {tierNames.map((n) => (
                <th
                  key={n}
                  className="max-w-24 truncate py-2 pr-2 text-center font-medium"
                  title={n}
                >
                  {n.split(" ")[0]}
                </th>
              ))}
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-t border-border">
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={r.day_number}
                    onChange={(e) => update(idx, { day_number: Number(e.target.value) || 1 })}
                    className="w-14 rounded border border-border bg-background px-2 py-1 text-foreground focus:border-primary focus:outline-none"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={r.time_label ?? ""}
                    onChange={(e) => update(idx, { time_label: e.target.value })}
                    placeholder="—"
                    className="w-32 rounded border border-border bg-background px-2 py-1 text-foreground focus:border-primary focus:outline-none"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={r.activity}
                    onChange={(e) => update(idx, { activity: e.target.value })}
                    className="w-full min-w-48 rounded border border-border bg-background px-2 py-1 text-foreground focus:border-primary focus:outline-none"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={r.note ?? ""}
                    onChange={(e) => update(idx, { note: e.target.value })}
                    placeholder="—"
                    className="w-40 rounded border border-border bg-background px-2 py-1 text-foreground focus:border-primary focus:outline-none"
                  />
                </td>
                {(["tier1_included", "tier2_included", "tier3_included"] as const).map((k) => (
                  <td key={k} className="py-2 pr-2 text-center">
                    <input
                      type="checkbox"
                      checked={r[k]}
                      onChange={(e) =>
                        update(idx, { [k]: e.target.checked } as Partial<ItineraryRowT>)
                      }
                      className="h-4 w-4 accent-[#2C3E2D]"
                    />
                  </td>
                ))}
                <td className="py-2 text-right">
                  <button
                    onClick={() => {
                      setRows((prev) => prev.filter((_, i) => i !== idx));
                      setDirty(true);
                    }}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
