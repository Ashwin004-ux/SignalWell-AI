alter table public.daily_activity
  add column if not exists mobile_social_media_minutes integer
  check (mobile_social_media_minutes is null or mobile_social_media_minutes between 0 and 1440);
