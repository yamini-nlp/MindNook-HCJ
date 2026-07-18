CREATE TABLE IF NOT EXISTS explanation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entry_id UUID,
  disagreed_layer TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE explanation_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own explanation feedback" ON explanation_feedback;
CREATE POLICY "Users manage own explanation feedback" ON explanation_feedback
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);