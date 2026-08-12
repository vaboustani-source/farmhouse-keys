import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/lb/AdminShell";
import { createPopupEvent } from "@/lib/popup-admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/popups/new")({
  component: NewPopupPage,
});

function NewPopupPage() {
  const navigate = useNavigate();
  const create = useServerFn(createPopupEvent);
  const [title, setTitle] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [heroIntro, setHeroIntro] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !checkIn || !checkOut) return;
    if (checkOut <= checkIn) {
      toast.error("Checkout must be after check-in.");
      return;
    }
    setSubmitting(true);
    try {
      const { eventId } = await create({
        data: {
          title: title.trim(),
          checkInDate: checkIn,
          checkOutDate: checkOut,
          heroIntro: heroIntro.trim() || undefined,
        },
      });
      toast.success("Pop-up weekend created — three tiers seeded and ready to price.");
      navigate({ to: "/events/$eventId/tiers", params: { eventId } });
    } catch (err) {
      console.error("createPopupEvent failed", err);
      toast.error("Could not create the pop-up weekend. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminShell>
      <div className="mx-auto max-w-xl">
        <Link
          to="/"
          className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
        >
          ← All events
        </Link>
        <h1 className="mt-4 font-serif text-4xl font-medium text-foreground">New Pop-Up Weekend</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A public, tier-based weekend. Three tiers are created automatically with the standard
          itinerary — you'll review pricing and the schedule next.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Weekend name
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The October Pop-Up Weekend"
              className="mt-1.5 w-full rounded border border-border bg-card px-4 py-3 text-base text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Check-in
              </label>
              <input
                type="date"
                required
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="mt-1.5 w-full rounded border border-border bg-card px-4 py-3 text-base text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Checkout
              </label>
              <input
                type="date"
                required
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="mt-1.5 w-full rounded border border-border bg-card px-4 py-3 text-base text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Landing page intro (optional)
            </label>
            <textarea
              value={heroIntro}
              onChange={(e) => setHeroIntro(e.target.value)}
              rows={3}
              placeholder="One warm paragraph welcoming the public to the estate for the weekend."
              className="mt-1.5 w-full rounded border border-border bg-card px-4 py-3 text-base text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !title || !checkIn || !checkOut}
            className="w-full rounded bg-primary px-4 py-3 text-sm uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Setting the weekend up…" : "Create pop-up weekend"}
          </button>
        </form>
      </div>
    </AdminShell>
  );
}
