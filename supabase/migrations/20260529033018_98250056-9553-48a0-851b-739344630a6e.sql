SELECT cron.unschedule('weekly-system-check') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-system-check');

SELECT cron.schedule(
  'weekly-system-check',
  '0 14 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://orbzcbnhljpriwuvxsjr.supabase.co/functions/v1/system-health-check',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYnpjYm5obGpwcml3dXZ4c2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDMxMTUsImV4cCI6MjA4OTk3OTExNX0.tOBznnC2AaFKWw1QYV-B223XB-If6aBogL2q-sWkbs8',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);