-- SignalWell AI — Database Schema
-- Run this against a Supabase Postgres project (SQL Editor, or `supabase db push`).
-- This file defines tables and indexes only. Row Level Security policies live in policies.sql
-- and MUST be applied as well — this schema is not safe to use without them.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user, linked 1:1 to auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  date_of_birth date,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- daily_activity: one row per user per day; browser totals plus optional manual mobile social-media time
-- ---------------------------------------------------------------------------
create table if not exists public.daily_activity (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  total_screen_time_minutes integer not null default 0 check (total_screen_time_minutes >= 0),
  active_device_minutes integer not null default 0 check (active_device_minutes >= 0),
  social_media_minutes integer not null default 0 check (social_media_minutes >= 0),
  entertainment_minutes integer not null default 0 check (entertainment_minutes >= 0),
  productivity_minutes integer not null default 0 check (productivity_minutes >= 0),
  communication_minutes integer not null default 0 check (communication_minutes >= 0),
  education_minutes integer not null default 0 check (education_minutes >= 0),
  gaming_minutes integer not null default 0 check (gaming_minutes >= 0),
  late_night_usage_minutes integer not null default 0 check (late_night_usage_minutes >= 0),
  notifications_count integer not null default 0 check (notifications_count >= 0),
  app_switches integer not null default 0 check (app_switches >= 0),
  tracking_coverage_minutes integer not null default 0 check (tracking_coverage_minutes between 0 and 1440),
  mobile_social_media_minutes integer check (mobile_social_media_minutes is null or mobile_social_media_minutes between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_activity add column if not exists tracking_coverage_minutes integer not null default 0 check (tracking_coverage_minutes between 0 and 1440);
alter table public.daily_activity add column if not exists mobile_social_media_minutes integer check (mobile_social_media_minutes is null or mobile_social_media_minutes between 0 and 1440);

create index if not exists idx_daily_activity_user_id on public.daily_activity(user_id);
create index if not exists idx_daily_activity_date on public.daily_activity(date);
create index if not exists idx_daily_activity_user_date on public.daily_activity(user_id, date);

-- ---------------------------------------------------------------------------
-- application_usage: per-app/per-domain usage rows that roll up into daily_activity
-- ---------------------------------------------------------------------------
create table if not exists public.application_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  application_name text not null,
  category text not null check (
    category in ('social_media','entertainment','productivity','communication','education','gaming','other')
  ),
  usage_minutes integer not null default 0 check (usage_minutes >= 0),
  launch_count integer not null default 0 check (launch_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_app_usage_user_id on public.application_usage(user_id);
create index if not exists idx_app_usage_date on public.application_usage(date);
create index if not exists idx_app_usage_user_date on public.application_usage(user_id, date);
create index if not exists idx_app_usage_application_name on public.application_usage(application_name);

-- ---------------------------------------------------------------------------
-- sleep_records: one row per user per night
-- ---------------------------------------------------------------------------
create table if not exists public.sleep_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep_start timestamptz,
  sleep_end timestamptz,
  sleep_duration_minutes integer check (sleep_duration_minutes >= 0),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  interruptions integer not null default 0 check (interruptions >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_sleep_user_id on public.sleep_records(user_id);
create index if not exists idx_sleep_date on public.sleep_records(date);
create index if not exists idx_sleep_user_date on public.sleep_records(user_id, date);

-- ---------------------------------------------------------------------------
-- mood_records: self-reported wellbeing entries, one per user per day (can be amended)
-- ---------------------------------------------------------------------------
create table if not exists public.mood_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  mood_score smallint not null check (mood_score between 1 and 10),
  stress_score smallint not null check (stress_score between 1 and 10),
  anxiety_score smallint not null check (anxiety_score between 1 and 10),
  wellbeing_score smallint not null check (wellbeing_score between 1 and 10),
  energy_score smallint check (energy_score between 1 and 10),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_mood_user_id on public.mood_records(user_id);
create index if not exists idx_mood_date on public.mood_records(date);
create index if not exists idx_mood_user_date on public.mood_records(user_id, date);

-- ---------------------------------------------------------------------------
-- ai_analysis: generated daily/weekly analysis records
-- ---------------------------------------------------------------------------
create table if not exists public.ai_analysis (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  period text not null default 'daily' check (period in ('daily','weekly')),
  overall_wellbeing_score numeric(4,1),
  stress_indicator text check (stress_indicator in ('stable','monitor','elevated')),
  anxiety_indicator text check (anxiety_indicator in ('stable','monitor','elevated')),
  mood_indicator text check (mood_indicator in ('stable','monitor','elevated')),
  sleep_indicator text check (sleep_indicator in ('stable','monitor','elevated')),
  digital_habit_indicator text check (digital_habit_indicator in ('stable','monitor','elevated')),
  risk_level text not null default 'stable' check (risk_level in ('stable','monitor','elevated')),
  confidence numeric(3,2) check (confidence between 0 and 1),
  summary text,
  contributing_factors jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  model_name text,
  created_at timestamptz not null default now(),
  unique (user_id, date, period)
);

create index if not exists idx_ai_analysis_user_id on public.ai_analysis(user_id);
create index if not exists idx_ai_analysis_risk_level on public.ai_analysis(risk_level);
create index if not exists idx_ai_analysis_user_date on public.ai_analysis(user_id, date);

-- ---------------------------------------------------------------------------
-- chatbot_conversations / chatbot_messages
-- ---------------------------------------------------------------------------
create table if not exists public.chatbot_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_user_id on public.chatbot_conversations(user_id);

create table if not exists public.chatbot_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.chatbot_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation_id on public.chatbot_messages(conversation_id);
create index if not exists idx_messages_user_id on public.chatbot_messages(user_id);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (
    type in ('high_screen_time','late_night_usage','sleep_pattern','positive_change','system')
  ),
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info','notice','elevated')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read);

-- ---------------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  data_collection_enabled boolean not null default true,
  chatbot_enabled boolean not null default true,
  analytics_enabled boolean not null default true,
  chatbot_can_access_activity_data boolean not null default true,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- extension_devices: tracks linked browser-extension installs per user
-- ---------------------------------------------------------------------------
create table if not exists public.extension_devices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null default 'Browser extension',
  browser text,
  last_synced_at timestamptz,
  tracking_paused boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_extension_devices_user_id on public.extension_devices(user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_activity_updated_at on public.daily_activity;
create trigger trg_daily_activity_updated_at before update on public.daily_activity
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_conversations_updated_at on public.chatbot_conversations;
create trigger trg_conversations_updated_at before update on public.chatbot_conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile + default settings when a new auth user is created
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  insert into public.user_settings (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
