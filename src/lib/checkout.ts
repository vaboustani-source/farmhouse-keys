import { supabase } from "@/integrations/supabase/client";

export type CreateCheckoutSessionInput = {
  bookingId: string;
  addonIds: string[];
  secondaryBookingId?: string | null;
  secondaryAddonIds: string[];
  eventSlug: string;
  sectionSlug: string;
  cotRequested: boolean;
};

/**
 * Creates a Stripe Checkout Session by invoking the
 * `create-checkout-session` Supabase Edge Function from the browser.
 * Returns the hosted Checkout URL. STRIPE_SECRET_KEY lives only in the
 * edge function environment, never in the client bundle.
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<{ url: string | null; alreadyPaid?: boolean; redirectUrl?: string; reused?: boolean }> {
  const { data, error } = await supabase.functions.invoke<{
    url: string | null;
    error?: string;
    already_paid?: boolean;
    redirect_url?: string;
    reused?: boolean;
  }>("create-checkout-session", { body: input });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return {
    url: data?.url ?? null,
    alreadyPaid: data?.already_paid,
    redirectUrl: data?.redirect_url,
    reused: data?.reused,
  };
}

export async function checkSessionStatus(
  sessionId: string,
): Promise<{ status: "open" | "complete" | "expired" | null; url?: string | null }> {
  const { data, error } = await supabase.functions.invoke<{
    status: "open" | "complete" | "expired";
    url?: string | null;
    error?: string;
  }>("check-session-status", { body: { sessionId } });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { status: data?.status ?? null, url: data?.url };
}