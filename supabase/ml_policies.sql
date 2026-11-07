-- SignalWell AI — RLS for ml_models and ml_predictions. Apply after
-- ml_schema.sql, same rule as policies.sql for the main schema.

alter table public.ml_models enable row level security;
alter table public.ml_predictions enable row level security;

-- ml_models is internal model-development metadata, not something any
-- end user needs to read directly (the app shows predictions and the
-- LLM's explanation of them, not the model registry). No policy at all
-- means no role using the anon/authenticated key can select, insert,
-- update, or delete it — only the service-role key (used exclusively by
-- backend/scripts/train_wellbeing_model.py and trusted server code) can
-- touch this table. If a future admin dashboard needs to show it to
-- staff, add a policy scoped to a staff role — not to all authenticated
-- users.

-- ml_predictions: a user can read their own predictions (e.g. to show
-- "estimated wellbeing: 6.2" alongside the LLM's explanation of it) but
-- never another user's, and never write to it directly — predictions are
-- only ever written by server-side code using the service-role key, the
-- same "AI interpretation is never user-editable" boundary ai_analysis
-- already uses (see policies.sql's notes at the bottom of that file).
create policy "ml_predictions_select_own" on public.ml_predictions
  for select using (auth.uid() = user_id);
create policy "ml_predictions_delete_own" on public.ml_predictions
  for delete using (auth.uid() = user_id);

-- Storage: serialized model artifacts (see ml_models.storage_path) live in
-- a PRIVATE bucket, created once via the Supabase dashboard or:
--   select storage.create_bucket('ml-models', public := false);
-- No storage.objects policy is added for it, which — same reasoning as
-- ml_models having no policy above — means only the service-role key can
-- read or write it. Trained model files are not user data and must never
-- be readable by the anon/authenticated role or exposed via a public
-- bucket URL.
