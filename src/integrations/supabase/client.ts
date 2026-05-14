import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export type LbEvent = {
  id: string;
  wedding_name: string;
  couple_names: string;
  wedding_date: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  nights: number;
  status: "draft" | "active" | "closed";
  tax_pct: number;
  resort_fee_pct: number;
  created_at: string;
  updated_at: string;
};

export type LbRoomSection = {
  id: string;
  event_id: string;
  section_name: string;
  total_rooms: number;
  price_per_night: number;
  booking_link_slug: string | null;
  is_active: boolean;
  sort_order: number;
  internal_nightly_rate: number;
  couple_contribution: number;
  guest_nightly_rate: number | null;
  resort_fee_percent: number;
  processing_fee_percent: number;
  tax_percent: number;
  payment_schedule: "full_upfront" | "deposit_50_balance_50" | "full" | "split_50_50";
  nights: number;
  cot_1night_rate: number;
  cot_2night_rate: number;
};

export type LbSectionAddon = {
  id: string;
  event_id: string;
  section_id: string;
  addon_name: string;
  addon_price: number;
  addon_type: "per_stay" | "per_night" | "per_person";
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
};

export type LbBooking = {
  id: string;
  event_id: string;
  section_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  nights_booked: number;
  addons_selected: Array<{ name: string; price: number }>;
  base_amount: number;
  addon_amount: number;
  resort_fee: number;
  tax_amount: number;
  total_amount: number;
  stripe_payment_id: string | null;
  payment_status: "pending" | "paid" | "failed";
  booked_at: string;
  room_assignment: string | null;
  cot_requested: boolean;
  cot_fee: number;
};

export type GuestInvitation = {
  id: string;
  event_id: string;
  section_id: string;
  guest_email: string;
  guest_name: string;
  invite_group: string;
  room_allocation: number;
  rooms_booked: number;
  secondary_booking_for: string | null;
  invited_by_couple_at: string;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
};