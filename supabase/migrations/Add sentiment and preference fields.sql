ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS sentiment_score FLOAT,
  ADD COLUMN IF NOT EXISTS sentiment_baseline_delta FLOAT,
  ADD COLUMN IF NOT EXISTS layer_enrichment_status TEXT DEFAULT 'pending';

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS cfp_weight FLOAT DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS cfn_weight FLOAT DEFAULT 0.6,
  ADD COLUMN IF NOT EXISTS intervention_preference TEXT DEFAULT 'balanced';