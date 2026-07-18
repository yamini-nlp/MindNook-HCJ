CREATE TABLE IF NOT EXISTS user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'explicit' CHECK (type IN ('explicit','implicit','meta')),
  confidence FLOAT DEFAULT 1.0,
  source TEXT NOT NULL DEFAULT 'onboarding' CHECK (source IN ('onboarding','inferred')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','rejected','pending_confirmation')),
  confirmation_count INT DEFAULT 0,
  rejection_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_goals_user_status ON user_goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_text ON user_goals(user_id, text);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own goals" ON user_goals;
CREATE POLICY "Users manage own goals" ON user_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS tau_goal FLOAT DEFAULT 0.6;

-- Keeps the legacy flat user_preferences.goals array in sync with the typed
-- user_goals table so existing reads (localStorage sync, computeGoalAlignment
-- fallback path) keep working without modification.
CREATE OR REPLACE FUNCTION sync_user_preferences_goals()
RETURNS TRIGGER AS $$
DECLARE
  target_user UUID;
  goal_texts TEXT[];
BEGIN
  target_user := COALESCE(NEW.user_id, OLD.user_id);
  SELECT COALESCE(array_agg(text ORDER BY created_at), ARRAY[]::TEXT[])
  INTO goal_texts
  FROM user_goals
  WHERE user_id = target_user AND status = 'active' AND type IN ('explicit','implicit');

  UPDATE user_preferences SET goals = to_jsonb(goal_texts) WHERE user_id = target_user;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_user_preferences_goals ON user_goals;
CREATE TRIGGER trg_sync_user_preferences_goals
AFTER INSERT OR UPDATE OR DELETE ON user_goals
FOR EACH ROW EXECUTE FUNCTION sync_user_preferences_goals();