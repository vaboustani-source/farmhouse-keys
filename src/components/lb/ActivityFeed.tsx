import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CreditCard,
  Cpu,
  Download,
  Mail,
  Settings as SettingsIcon,
  Undo2,
  UserCheck,
} from "lucide-react";
import { listActivity, listEventsForFilter } from "@/lib/activity.functions";
import { supabase } from "@/integrations/supabase/client";

type Category = "all" | "bookings" | "payments" | "admin" | "system";
type Actor = "all" | "admin" | "guest" | "system" | "stripe";

type ActivityRow = {
  id: string;
  event_id: string | null;
  booking_id: string | null;
  actor: string;
  actor_name: string | null;
  action: string;
  label: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function categoryOf(action: string): Category {
  if (action.startsWith("booking.")) return "bookings";
  if (action.startsWith("payment.") || action.startsWith("refund.") || action.startsWith("charge.")) return "payments";
  if (action.startsWith("pricing.") || action.startsWith("guest.") || action.startsWith("event.")) return "admin";
  return "system";
}

function iconFor(action: string) {
  if (action.endsWith(".failed")) return { Icon: AlertCircle, color: "text-red-600 bg-red-50 border-red-200" };
  if (action.startsWith("refund.")) return { Icon: Undo2, color: "text-red-700 bg-red-50 border-red-200" };
  if (action.startsWith("payment.") || action.startsWith("charge.")) return { Icon: CreditCard, color: "text-amber-700 bg-amber-50 border-amber-200" };
  if (action.startsWith("booking.")) return { Icon: UserCheck, color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (action.startsWith("email.")) return { Icon: Mail, color: "text-blue-700 bg-blue-50 border-blue-200" };
  if (action.startsWith("pricing.") || action.startsWith("guest.") || action.startsWith("event.")) return { Icon: SettingsIcon, color: "text-muted-foreground bg-muted border-border" };
  return { Icon: Cpu, color: "text-muted-foreground bg-muted border-border" };
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMetadata(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (typeof meta.amount === "number") parts.push(`$${meta.amount.toFixed(2)}`);
  if (typeof meta.section_name === "string") parts.push(meta.section_name);
  if (typeof meta.old_value !== "undefined" && typeof meta.new_value !== "undefined") {
    parts.push(`${String(meta.old_value)} → ${String(meta.new_value)}`);
  }
  if (typeof meta.reason === "string") parts.push(`Reason: ${meta.reason}`);
  if (typeof meta.count === "number") parts.push(`${meta.count} guests`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function ActivityFeed({
  eventId,
  showEventTag = false,
}: {
  eventId?: string;
  showEventTag?: boolean;
}) {
  const fetchActivity = listActivity;
  const fetchEvents = listEventsForFilter;
  const qc = useQueryClient();

  const [category, setCategory] = useState<Category>("all");
  const [actor, setActor] = useState<Actor>("all");
  const [filterEvent, setFilterEvent] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulated, setAccumulated] = useState<ActivityRow[]>([]);

  const filterArgs = useMemo(() => ({
    eventId: eventId ?? (filterEvent || undefined),
    category,
    actor,
    from: fromDate ? new Date(fromDate).toISOString() : undefined,
    to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
    limit: 200,
    cursor,
  }), [eventId, filterEvent, category, actor, fromDate, toDate, cursor]);

  const queryKey = useMemo(
    () => ["activity", eventId ?? "global", category, actor, filterEvent, fromDate, toDate, cursor],
    [eventId, category, actor, filterEvent, fromDate, toDate, cursor],
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchActivity({ data: filterArgs }),
  });

  // Reset accumulated rows when filters change (except cursor pagination)
  useEffect(() => {
    setAccumulated([]);
    setCursor(undefined);
  }, [eventId, category, actor, filterEvent, fromDate, toDate]);

  useEffect(() => {
    if (data?.rows) {
      const incoming = data.rows as unknown as ActivityRow[];
      setAccumulated((prev) => {
        if (cursor) {
          const ids = new Set(prev.map((r) => r.id));
          return [...prev, ...incoming.filter((r) => !ids.has(r.id))];
        }
        return incoming;
      });
    }
  }, [data, cursor]);

  // Events for filter dropdown (global view only)
  const { data: eventsData } = useQuery({
    queryKey: ["activity-events"],
    queryFn: () => fetchEvents(),
    enabled: !eventId,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`activity:${eventId ?? "global"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lb_activity_log",
          ...(eventId ? { filter: `event_id=eq.${eventId}` } : {}),
        },
        (payload) => {
          const row = payload.new as ActivityRow;
          setAccumulated((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            return [row, ...prev];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const filtered = useMemo(() => {
    let rows = accumulated;
    if (category !== "all") rows = rows.filter((r) => categoryOf(r.action) === category);
    if (actor !== "all") rows = rows.filter((r) => r.actor === actor);
    if (filterEvent && !eventId) rows = rows.filter((r) => r.event_id === filterEvent);
    return rows;
  }, [accumulated, category, actor, filterEvent, eventId]);

  const eventNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of eventsData?.events ?? []) {
      map.set(e.id, e.couple_names || e.wedding_name);
    }
    return map;
  }, [eventsData]);

  const exportCsv = () => {
    const headers = ["Date", "Actor", "Action", "Label", "Event", "Metadata"];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      const cells = [
        new Date(r.created_at).toISOString(),
        r.actor_name ? `${r.actor} (${r.actor_name})` : r.actor,
        r.action,
        r.label,
        r.event_id ? (eventNameMap.get(r.event_id) ?? r.event_id) : "",
        r.metadata ? JSON.stringify(r.metadata) : "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "bookings", "payments", "admin", "system"] as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
                category === c
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "all" ? "All activity" : c}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {!eventId && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/40 px-3 py-2 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Event</span>
            <select
              value={filterEvent}
              onChange={(e) => { qc.invalidateQueries({ queryKey: ["activity"] }); setFilterEvent(e.target.value); }}
              className="rounded border border-border bg-background px-2 py-1"
            >
              <option value="">All events</option>
              {(eventsData?.events ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.couple_names || e.wedding_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Actor</span>
            <select
              value={actor}
              onChange={(e) => setActor(e.target.value as Actor)}
              className="rounded border border-border bg-background px-2 py-1"
            >
              <option value="all">All</option>
              <option value="admin">Admin</option>
              <option value="guest">Guest</option>
              <option value="system">System</option>
              <option value="stripe">Stripe</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-muted-foreground">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-muted-foreground">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
        </div>
      )}

      {isLoading && accumulated.length === 0 && (
        <div className="rounded-md border border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Loading activity…
        </div>
      )}
      {isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load activity: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}
      {!isLoading && filtered.length === 0 && (
        <div className="rounded-md border border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No activity yet.
        </div>
      )}

      <ol className="space-y-2">
        {filtered.map((row) => {
          const { Icon, color } = iconFor(row.action);
          const meta = fmtMetadata(row.metadata);
          const evName = showEventTag && row.event_id ? eventNameMap.get(row.event_id) : null;
          return (
            <li
              key={row.id}
              className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5"
            >
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${color}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-foreground">{row.label}</p>
                  <time
                    className="text-[11px] uppercase tracking-wider text-muted-foreground"
                    title={new Date(row.created_at).toLocaleString()}
                  >
                    {timeAgo(row.created_at)}
                  </time>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {meta && <span>{meta}</span>}
                  {row.actor_name && <span>· {row.actor_name}</span>}
                  {evName && (
                    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      {evName}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {data?.rows && data.rows.length === 200 && (
        <div className="flex justify-center">
          <button
            onClick={() => {
              const last = accumulated[accumulated.length - 1];
              if (last) setCursor(last.created_at);
            }}
            className="rounded-full border border-border px-4 py-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}