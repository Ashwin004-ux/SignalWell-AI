-- Alternative to vercel.json: schedule the two daily jobs directly from
-- Supabase using pg_cron + pg_net, for deployments not hosted on Vercel.
-- Run this in the Supabase SQL editor after deploying the app.
--
-- Replace:
--   https://your-domain.example.com   with your deployed app's URL
--   YOUR_CRON_SECRET_HERE             with the same value as CRON_SECRET
--                                     in your app's environment variables
--
-- Only use ONE scheduling method in production — either this, or
-- vercel.json, not both, or the jobs will run twice (each run is
-- idempotent per user per day, so double-running is wasteful but not
-- unsafe — it just costs an extra AI API call that gets skipped once it
-- sees today's row already exists).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'signalwell-generate-insights',
  '0 10 * * *', -- 10:00 UTC daily; adjust to your users' typical timezone
  $$
  select net.http_post(
    url := 'https://your-domain.example.com/api/cron/generate-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET_HERE'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'signalwell-generate-notifications',
  '30 10 * * *',
  $$
  select net.http_post(
    url := 'https://your-domain.example.com/api/cron/generate-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET_HERE'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To inspect scheduled jobs:    select * from cron.job;
-- To see recent run history:   select * from cron.job_run_details order by start_time desc limit 20;
-- To remove a schedule:        select cron.unschedule('signalwell-generate-insights');
