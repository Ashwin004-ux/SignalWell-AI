-- Exports one flat row per (user_id, date) joining daily_activity,
-- sleep_records, and mood_records — exactly the columns
-- app/ml/data/validation.py's REQUIRED_COLUMNS expects.
--
-- Run this against your Supabase project (SQL editor, or psql/pg via the
-- connection string) and save the output as CSV for
-- scripts/train_wellbeing_model.py --input.
--
-- IMPORTANT: run this with a role that can see data across users (i.e.
-- service-role / postgres, NOT the anon/authenticated role, which RLS
-- would otherwise restrict to a single user's own rows). This export
-- contains data from every consenting user and must be handled like any
-- other research dataset — see Section 36 of the product spec
-- (de-identification, no PII in downstream artifacts) and
-- docs/ROADMAP.md's research-export item for what's still needed before
-- this is a proper anonymized research export rather than a raw pull for
-- internal model development.
--
-- Only includes users who have NOT disabled analytics (user_settings
-- .analytics_enabled), matching the same consent check the live AI
-- analysis feature respects.

select
  da.user_id,
  da.date,
  da.total_screen_time_minutes,
  da.social_media_minutes,
  da.late_night_usage_minutes,
  da.notifications_count,
  da.app_switches,
  sr.sleep_duration_minutes,
  mr.mood_score,
  mr.stress_score,
  mr.anxiety_score,
  mr.wellbeing_score,
  mr.energy_score,
  da.created_at
from public.daily_activity da
left join public.sleep_records sr
  on sr.user_id = da.user_id and sr.date = da.date
left join public.mood_records mr
  on mr.user_id = da.user_id and mr.date = da.date
inner join public.user_settings us
  on us.user_id = da.user_id and us.analytics_enabled is not false
where mr.wellbeing_score is not null  -- the regression target must be present
order by da.user_id, da.date;
