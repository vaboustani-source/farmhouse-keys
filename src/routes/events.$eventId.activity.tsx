import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/lb/AdminShell";
import { EventLayout } from "@/components/lb/EventNav";
import { ActivityFeed } from "@/components/lb/ActivityFeed";

export const Route = createFileRoute("/events/$eventId/activity")({
  component: ActivityPage,
});

function ActivityPage() {
  const { eventId } = Route.useParams();
  return (
    <AdminShell>
      <EventLayout eventId={eventId} currentTab={"activity" as never}>
        <div className="space-y-6">
          <header>
            <h1 className="font-serif text-3xl text-foreground">Activity</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every booking, payment, and admin change for this event.
            </p>
          </header>
          <ActivityFeed eventId={eventId} />
        </div>
      </EventLayout>
    </AdminShell>
  );
}