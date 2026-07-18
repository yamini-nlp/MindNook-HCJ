CREATE TABLE IF NOT EXISTS action_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id BIGINT REFERENCES journal_entries(id),
  action TEXT,
  rating TEXT CHECK (rating IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_action_feedback_user_created ON action_feedback(user_id, created_at DESC);
ALTER TABLE action_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own action feedback" ON action_feedback;
CREATE POLICY "Users manage own action feedback" ON action_feedback
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS weights_last_adjusted_at TIMESTAMPTZ;