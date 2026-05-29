-- pg_cron and pg_net already enabled on this project.

-- Remove prior schedule if it exists, so this migration is idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'collect-balance-payments') THEN
    PERFORM cron.unschedule('collect-balance-payments');
  END IF;
END $$;

-- Daily at 14:00 UTC (9am ET during EDT). Invokes the collect-balance-payments
-- edge function which charges the remaining 50% for split bookings whose
-- check_in_date is exactly 30 days away, and sends a heads-up reminder email
-- for bookings whose check_in_date is 37 days away.
SELECT cron.schedule(
  'collect-balance-payments',
  '0 14 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://orbzcbnhljpriwuvxsjr.supabase.co/functions/v1/collect-balance-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYnpjYm5obGpwcml3dXZ4c2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDMxMTUsImV4cCI6MjA4OTk3OTExNX0.tOBznnC2AaFKWw1QYV-B223XB-If6aBogL2q-sWkbs8'
    ),
    body := '{}'::jsonb
  );
  $cron$
);