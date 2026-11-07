-- SignalWell AI — ML model registry and predictions
-- Run after schema.sql. RLS for these tables is in ml_policies.sql, which
-- MUST be applied too (same rule as schema.sql / policies.sql).
--
-- Two tables, matching the Python side in backend/app/ml/:
--   ml_models      — one row per trained model candidate (every candidate
--                     from a training run, not just the winner — see
--                     backend/app/ml/models/registry.py).
--   ml_predictions — one row per individual prediction made with a
--                     specific ml_models row, kept separate from
--                     ai_analysis (the LLM's plain-language output) per
--                     the spec's required ML/LLM separation: the numeric
--                     prediction here is never edited by the LLM layer.

create table if not exists public.ml_models (
  id uuid primary key default uuid_generate_v4(),
  model_name text not null,                    -- e.g. 'random_forest_regressor'
  model_version text not null,                  -- e.g. 'v1-2026-10-04'
  task text not null check (task in ('regression', 'classification')),
  training_dataset_version text not null,       -- content fingerprint, see registry.py
  feature_set_version text not null,
  feature_columns jsonb not null,
  training_date timestamptz not null,
  n_training_rows integer not null,
  n_training_users integer not null,
  evaluation_metrics jsonb not null,             -- {mae, rmse, r2} or {accuracy, precision_macro, ...}
  cv_scores jsonb not null default '[]'::jsonb,
  feature_importance jsonb not null default '{}'::jsonb,
  best_hyperparameters jsonb not null default '{}'::jsonb,
  is_best_in_run boolean not null default false,
  -- Path within the 'ml-models' Supabase Storage bucket to the serialized
  -- fitted pipeline (joblib), so the prediction service can load a model
  -- without retraining it. Null for older/metrics-only records, or for a
  -- candidate kept for comparison but never actually serialized.
  storage_path text,
  notes text,
  created_at timestamptz not null default now(),
  unique (model_name, model_version)
);

create index if not exists idx_ml_models_task on public.ml_models (task);
create index if not exists idx_ml_models_is_best on public.ml_models (is_best_in_run) where is_best_in_run;

create table if not exists public.ml_predictions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id uuid not null references public.ml_models(id) on delete restrict,
  date date not null,
  task text not null check (task in ('regression', 'classification')),
  predicted_value_numeric numeric(5,2),          -- populated for regression predictions
  predicted_value_label text,                    -- populated for classification predictions
  confidence numeric(4,3),                        -- null when no principled confidence exists (see predict.py)
  feature_contributions jsonb not null default '{}'::jsonb,  -- SHAP values for this prediction
  top_contributing_features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, model_id, date)
);

create index if not exists idx_ml_predictions_user_date on public.ml_predictions (user_id, date);
create index if not exists idx_ml_predictions_model on public.ml_predictions (model_id);
