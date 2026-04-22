import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/lb/AdminShell";

export const Route = createFileRoute("/events/new")({
  component: NewEventPage,
});

function NewEventPage() {
  const navigate = useNavigate();
  const [coupleNames, setCoupleNames] = useState("");
  const [weddingName, setWeddingName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [nights, setNights] = useState(2);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("lb_events")
        .insert({
          couple_names: coupleNames || "Untitled couple",
          wedding_name: weddingName || `${coupleNames} Wedding`,
          wedding_date: weddingDate || null,
          check_in_date: checkIn || null,
          check_out_date: checkOut || null,
          nights: nights || 2,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (event) => {
      toast.success("Block created — section defaults are in place.");
      navigate({ to: "/events/$eventId/edit", params: { eventId: event.id } });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not create event");
    },
  });

  return (
    <AdminShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-4xl font-medium text-foreground">A new lodging block</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The four houses are added automatically. You'll set rates and add-ons on the next page.
        </p>

        <div className="mt-10 space-y-6 rounded-lg border border-border bg-card p-8">
          <Field label="Who is celebrating?">
            <input
              value={coupleNames}
              onChange={(e) => {
                setCoupleNames(e.target.value);
                if (!weddingName) setWeddingName("");
              }}
              onBlur={() => {
                if (!weddingName && coupleNames) setWeddingName(`The ${coupleNames} Wedding`);
              }}
              placeholder="Aldridge & Fontaine"
              className="lb-input"
            />
          </Field>
          <Field label="Wedding name">
            <input
              value={weddingName}
              onChange={(e) => setWeddingName(e.target.value)}
              placeholder="The Aldridge-Fontaine Wedding"
              className="lb-input"
            />
          </Field>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Field label="Wedding date">
              <input type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} className="lb-input" />
            </Field>
            <Field label="Check-in">
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="lb-input" />
            </Field>
            <Field label="Check-out">
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="lb-input" />
            </Field>
          </div>
          <Field label="Nights">
            <input
              type="number"
              min={1}
              value={nights}
              onChange={(e) => setNights(parseInt(e.target.value) || 1)}
              className="lb-input w-32"
            />
          </Field>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button
              onClick={() => navigate({ to: "/" })}
              className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending || !coupleNames}
              className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create block"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .lb-input {
          width: 100%;
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 0.375rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          color: var(--foreground);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .lb-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 15%, transparent);
        }
      `}</style>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}