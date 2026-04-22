import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/lb/AdminShell";

export const Route = createFileRoute("/events/new")({
  component: NewEventRedirect,
});

function NewEventRedirect() {
  return (
    <AdminShell>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-4xl font-medium text-foreground">
          Blocks come from the planning hub
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Each lodging block is tied to a wedding already on the calendar. Open the wedding from the
          Lodging Blocks list and a block will be set up automatically — four houses, ten rooms each.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Back to Lodging Blocks
        </Link>
      </div>
    </AdminShell>
  );
}
