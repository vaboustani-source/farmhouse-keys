DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'keep-alive-edge-functions') THEN
    PERFORM cron.unschedule('keep-alive-edge-functions');
  END IF;
END $$;

SELECT cron.schedule(
  'keep-alive-edge-functions',
  '0 */6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://orbzcbnhljpriwuvxsjr.supabase.co/functions/v1/keep-alive',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYnpjYm5obGpwcml3dXZ4c2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDMxMTUsImV4cCI6MjA4OTk3OTExNX0.tOBznnC2AaFKWw1QYV-B223XB-If6aBogL2q-sWkbs8',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  SELECT net.http_post(
    url := 'https://orbzcbnhljpriwuvxsjr.supabase.co/functions/v1/create-checkout-session',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYnpjYm5obGpwcml3dXZ4c2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDMxMTUsImV4cCI6MjA4OTk3OTExNX0.tOBznnC2AaFKWw1QYV-B223XB-If6aBogL2q-sWkbs8',
      'Content-Type', 'application/json',
      'x-keep-alive', 'true'
    ),
    body := '{"ping":true}'::jsonb
  );
  SELECT net.http_post(
    url := 'https://orbzcbnhljpriwuvxsjr.supabase.co/functions/v1/collect-balance-payments',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYnpjYm5obGpwcml3dXZ4c2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDMxMTUsImV4cCI6MjA4OTk3OTExNX0.tOBznnC2AaFKWw1QYV-B223XB-If6aBogL2q-sWkbs8',
      'Content-Type', 'application/json',
      'x-keep-alive', 'true'
    ),
    body := '{"ping":true}'::jsonb
  );
  $cron$
);