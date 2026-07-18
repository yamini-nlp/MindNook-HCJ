CREATE TABLE IF NOT EXISTS escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT CHECK (type IN ('acute', 'pattern')),
  confidence FLOAT,
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE escalation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own escalation events" ON escalation_events;
CREATE POLICY "Users manage own escalation events" ON escalation_events
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS country TEXT;