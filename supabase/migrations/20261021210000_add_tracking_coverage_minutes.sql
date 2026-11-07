alter table public.daily_activity
  add column if not exists tracking_coverage_minutes integer not null default 0
  check (tracking_coverage_minutes between 0 and 1440);

notify pgrst, 'reload schema';
