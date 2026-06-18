import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarCheck, CreditCard, History, LayoutGrid, Settings, SlidersHorizontal, Users } from "lucide-react";
import { supabase, type LbEvent } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

export type EventTabKey =
  | "overview"
  | "guests"
  | "bookings"
  | "payments"
  | "activity"
  | "pricing"
  | "settings";

type Counts = {
  pending: number;
  failed: number;
  collected: number;
};

function useEventCounts(eventId: string) {
  const [counts, setCounts] = useState<Counts>({ pending: 0, failed: 0, collected: 0 });

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("lb_bookings")
        .select("payment_status,total_amount,removed")
        .eq("event_id", eventId);
      if (!active || !data) return;
      const next: Counts = { pending: 0, failed: 0, collected: 0 };
      for (const b of data as Array<{ payment_status: string; total_amount: number; removed: boolean | null }>) {
        if (b.removed) continue;
        if (b.payment_status === "pending") next.pending += 1;
        if (b.payment_status === "payment_failed") next.failed += 1;
        if (
          b.payment_status === "paid" ||
          b.payment_status === "deposit_paid" ||
          b.payment_status === "covered"
        ) {
          next.collected += Number(b.total_amount) || 0;
        }
      }
      setCounts(next);
    };
    load();
    const channel = supabase
      .channel(`lb_bookings_nav_${eventId}_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lb_bookings", filter: `event_id=eq.${eventId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return counts;
}

function useEventName(eventId: string) {
  const [name, setName] = useState<string>("");
  useEffect(() => {
    let active = true;
    supabase
      .from("lb_events")
      .select("couple_names,wedding_name")
      .eq("id", eventId)
      .single()
      .then(({ data }) => {
        if (!active || !data) return;
        const ev = data as Pick<LbEvent, "couple_names" | "wedding_name">;
        setName(ev.couple_names || ev.wedding_name || "Event");
      });
    return () => {
      active = false;
    };
  }, [eventId]);
  return name;
}

function formatMoneyShort(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
}

const TAB_LABEL: Record<EventTabKey, string> = {
  overview: "Overview",
  guests: "Guest List",
  bookings: "Bookings",
  payments: "Payments",
  activity: "Activity",
  pricing: "Pricing",
  settings: "Settings",
};

export function EventBreadcrumb({ eventId, tab }: { eventId: string; tab: EventTabKey }) {
  const name = useEventName(eventId);
  return (
    <nav className="mb-6 flex items-center gap-2 overflow-hidden text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
      <Link to="/" className="shrink-0 hover:text-foreground">All events</Link>
      <span>›</span>
      <Link
        to="/events/$eventId"
        params={{ eventId }}
        className="min-w-0 truncate hover:text-foreground"
      >
        {name || "…"}
      </Link>
      <span className="shrink-0">›</span>
      <span className="shrink-0 text-foreground">{TAB_LABEL[tab]}</span>
    </nav>
  );
}

type Item = {
  key: EventTabKey;
  label: string;
  icon: typeof LayoutGrid;
  to:
    | "/events/$eventId"
    | "/events/$eventId/guests"
    | "/events/$eventId/bookings"
    | "/events/$eventId/payments"
    | "/events/$eventId/activity"
    | "/events/$eventId/pricing"
    | "/events/$eventId/settings";
  badge?: { text: string; variant?: "default" | "danger" | "muted" };
};

export function EventSidebar({ eventId, currentTab }: { eventId: string; currentTab: EventTabKey }) {
  const counts = useEventCounts(eventId);
  const { hasFullAccessForEvent } = useAuth();
  const fullAccess = hasFullAccessForEvent(eventId);
  const items = buildItems(counts).filter(
    (it) => fullAccess || (it.key !== "pricing" && it.key !== "settings"),
  );

  return (
    <aside className="hidden md:block w-52 shrink-0">
      <nav className="sticky top-6 flex flex-col gap-1">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.key === currentTab;
          return (
            <Link
              key={it.key}
              to={it.to}
              params={{ eventId }}
              className={`group flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                {it.label}
              </span>
              {it.badge && <Badge {...it.badge} />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function EventMobileTabs({ eventId, currentTab }: { eventId: string; currentTab: EventTabKey }) {
  const counts = useEventCounts(eventId);
  const { hasFullAccessForEvent } = useAuth();
  const fullAccess = hasFullAccessForEvent(eventId);
  const all = buildItems(counts);
  // Mobile: 5 tabs max — merge Payments + Pricing into "Finance"
  const mobile: Array<{ key: EventTabKey; label: string; icon: typeof LayoutGrid; to: Item["to"]; badge?: Item["badge"] }> = [
    all.find((i) => i.key === "overview")!,
    all.find((i) => i.key === "guests")!,
    all.find((i) => i.key === "bookings")!,
    ...(fullAccess
      ? [{
          key: (currentTab === "pricing" ? "pricing" : "payments") as EventTabKey,
          label: "Finance",
          icon: CreditCard,
          to: "/events/$eventId/payments" as Item["to"],
          badge: all.find((i) => i.key === "payments")!.badge,
        }]
      : []),
    fullAccess
      ? all.find((i) => i.key === "settings")!
      : all.find((i) => i.key === "activity")!,
  ];
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <ul className="grid grid-cols-5">
        {mobile.map((it) => {
          const Icon = it.icon;
          const active =
            it.key === currentTab ||
            (it.label === "Finance" && (currentTab === "payments" || currentTab === "pricing"));
          return (
            <li key={it.label} className="flex justify-center">
              <Link
                to={it.to}
                params={{ eventId }}
                className={`relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-[11px] uppercase tracking-wider ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                aria-label={it.label}
              >
                <Icon className="h-5 w-5" />
                <span>{it.label}</span>
                {it.badge && (
                  <span
                    className={`absolute -top-0.5 right-2 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                      it.badge.variant === "danger"
                        ? "bg-red-600 text-white"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {it.badge.text}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Badge({ text, variant = "default" }: { text: string; variant?: "default" | "danger" | "muted" }) {
  const styles =
    variant === "danger"
      ? "bg-red-50 text-red-700 border-red-200"
      : variant === "muted"
        ? "bg-muted text-muted-foreground border-border"
        : "bg-primary/10 text-primary border-primary/20";
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] tabular-nums ${styles}`}>
      {text}
    </span>
  );
}

function buildItems(counts: Counts): Item[] {
  return [
    { key: "overview", label: "Overview", icon: LayoutGrid, to: "/events/$eventId" },
    {
      key: "guests",
      label: "Guest List",
      icon: Users,
      to: "/events/$eventId/guests",
      badge: counts.pending > 0 ? { text: `${counts.pending} awaiting`, variant: "muted" } : undefined,
    },
    {
      key: "bookings",
      label: "Bookings",
      icon: CalendarCheck,
      to: "/events/$eventId/bookings",
      badge: counts.failed > 0 ? { text: `${counts.failed} failed`, variant: "danger" } : undefined,
    },
    {
      key: "payments",
      label: "Payments",
      icon: CreditCard,
      to: "/events/$eventId/payments",
      badge: counts.collected > 0 ? { text: formatMoneyShort(counts.collected) } : undefined,
    },
    {
      key: "activity",
      label: "Activity",
      icon: History,
      to: "/events/$eventId/activity",
    },
    { key: "pricing", label: "Pricing", icon: SlidersHorizontal, to: "/events/$eventId/pricing" },
    { key: "settings", label: "Settings", icon: Settings, to: "/events/$eventId/settings" },
  ];
}

export function EventLayout({
  eventId,
  currentTab,
  children,
}: {
  eventId: string;
  currentTab: EventTabKey;
  children: React.ReactNode;
}) {
  // Pull pathname so a stale tab doesn't stay highlighted after navigation.
  useRouterState({ select: (s) => s.location.pathname });
  const { hasEventAccess, hasFullAccessForEvent, loading } = useAuth();
  if (loading) return null;
  if (!hasEventAccess(eventId)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="font-serif text-xl text-foreground">No access to this event</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't have access to this event. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }
  const fullAccess = hasFullAccessForEvent(eventId);
  // Block direct navigation to pricing/settings for limited roles.
  if (!fullAccess && (currentTab === "pricing" || currentTab === "settings")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="font-serif text-xl text-foreground">Restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This section is available to admins only.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-8 pb-20 md:pb-0">
      <EventSidebar eventId={eventId} currentTab={currentTab} />
      <div className="min-w-0 flex-1">
        <EventBreadcrumb eventId={eventId} tab={currentTab} />
        {children}
      </div>
      <EventMobileTabs eventId={eventId} currentTab={currentTab} />
    </div>
  );
}