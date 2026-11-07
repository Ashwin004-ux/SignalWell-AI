-- SignalWell AI — Row Level Security
-- Apply after schema.sql. Every table that stores user data enforces:
--   auth.uid() = user_id
-- for select/insert/update/delete, so a user can only ever see or write their own rows.
-- chatbot_messages is scoped via its own user_id column (denormalized from the
-- conversation) so the check does not require a join.

alter table public.profiles enable row level security;
alter table public.daily_activity enable row level security;
alter table public.application_usage enable row level security;
alter table public.sleep_records enable row level security;
alter table public.mood_records enable row level security;
alter table public.ai_analysis enable row level security;
alter table public.chatbot_conversations enable row level security;
alter table public.chatbot_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.user_settings enable row level security;
alter table public.extension_devices enable row level security;

-- profiles ---------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

-- daily_activity -----------------------------------------------------------
create policy "daily_activity_select_own" on public.daily_activity
  for select using (auth.uid() = user_id);
create policy "daily_activity_insert_own" on public.daily_activity
  for insert with check (auth.uid() = user_id);
create policy "daily_activity_update_own" on public.daily_activity
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_activity_delete_own" on public.daily_activity
  for delete using (auth.uid() = user_id);

-- application_usage --------------------------------------------------------
create policy "app_usage_select_own" on public.application_usage
  for select using (auth.uid() = user_id);
create policy "app_usage_insert_own" on public.application_usage
  for insert with check (auth.uid() = user_id);
create policy "app_usage_delete_own" on public.application_usage
  for delete using (auth.uid() = user_id);

-- sleep_records --------------------------------------------------------
create policy "sleep_select_own" on public.sleep_records
  for select using (auth.uid() = user_id);
create policy "sleep_insert_own" on public.sleep_records
  for insert with check (auth.uid() = user_id);
create policy "sleep_update_own" on public.sleep_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sleep_delete_own" on public.sleep_records
  for delete using (auth.uid() = user_id);

-- mood_records --------------------------------------------------------
create policy "mood_select_own" on public.mood_records
  for select using (auth.uid() = user_id);
create policy "mood_insert_own" on public.mood_records
  for insert with check (auth.uid() = user_id);
create policy "mood_update_own" on public.mood_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mood_delete_own" on public.mood_records
  for delete using (auth.uid() = user_id);

-- ai_analysis (read-only from the client; written by the server using the
-- service role from a trusted backend context, so no insert/update policy
-- for regular users — only select of their own rows)
create policy "ai_analysis_select_own" on public.ai_analysis
  for select using (auth.uid() = user_id);
create policy "ai_analysis_delete_own" on public.ai_analysis
  for delete using (auth.uid() = user_id);

-- chatbot_conversations --------------------------------------------------------
create policy "conversations_select_own" on public.chatbot_conversations
  for select using (auth.uid() = user_id);
create policy "conversations_insert_own" on public.chatbot_conversations
  for insert with check (auth.uid() = user_id);
create policy "conversations_update_own" on public.chatbot_conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "conversations_delete_own" on public.chatbot_conversations
  for delete using (auth.uid() = user_id);

-- chatbot_messages --------------------------------------------------------
create policy "messages_select_own" on public.chatbot_messages
  for select using (auth.uid() = user_id);
create policy "messages_insert_own" on public.chatbot_messages
  for insert with check (auth.uid() = user_id);
create policy "messages_delete_own" on public.chatbot_messages
  for delete using (auth.uid() = user_id);

-- notifications --------------------------------------------------------
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications_insert_own" on public.notifications
  for insert with check (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications_delete_own" on public.notifications
  for delete using (auth.uid() = user_id);

-- user_settings --------------------------------------------------------
create policy "settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- extension_devices --------------------------------------------------------
create policy "devices_select_own" on public.extension_devices
  for select using (auth.uid() = user_id);
create policy "devices_insert_own" on public.extension_devices
  for insert with check (auth.uid() = user_id);
create policy "devices_update_own" on public.extension_devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "devices_delete_own" on public.extension_devices
  for delete using (auth.uid() = user_id);

-- Notes on ai_analysis writes:
-- The dashboard client never writes ai_analysis directly. A server-side route
-- (using the service role key, which never reaches the browser or extension)
-- runs the aggregation + AI analysis pipeline and inserts rows there. This
-- keeps the "AI interpretation vs. observed data" boundary enforced at the
-- database layer, not just in the UI.
