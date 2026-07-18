CREATE TABLE IF NOT EXISTS user_temporal_state (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  hidden_state JSONB,
  cell_state JSONB,
  last_entry_id BIGINT REFERENCES journal_entries(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_temporal_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own temporal state" ON user_temporal_state;
CREATE POLICY "Users manage own temporal state" ON user_temporal_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS layer3_probabilities JSONB;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS layer3_attention JSONB;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS layer3_method TEXT DEFAULT 'lstm';