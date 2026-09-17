-- Superseded by referral_reward_amount + referral_friend_percent; nothing reads it any more.
ALTER TABLE public.lb_events DROP COLUMN IF EXISTS referral_percent;
