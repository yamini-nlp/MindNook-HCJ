CREATE TABLE IF NOT EXISTS moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entry_id BIGINT REFERENCES journal_entries(id),
  category TEXT,
  confidence FLOAT,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE moderation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own moderation events" ON moderation_events;
CREATE POLICY "Users read own moderation events" ON moderation_events
  FOR SELECT USING (auth.uid() = user_id);