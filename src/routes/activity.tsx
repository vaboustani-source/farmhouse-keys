import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/lb/AdminShell";
import { ActivityFeed } from "@/components/lb/ActivityFeed";

export const Route = createFileRoute("/activity")({
  component: GlobalActivityPage,
});

function GlobalActivityPage() {
  return (
    <AdminShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-serif text-3xl text-foreground">Activity Log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every action across every event, in reverse chronological order.
          </p>
        </header>
        <ActivityFeed showEventTag />
      </div>
    </AdminShell>
  );
}