CREATE TABLE IF NOT EXISTS user_consent_scopes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sentiment BOOLEAN DEFAULT true,
  pragmatic BOOLEAN DEFAULT true,
  temporal BOOLEAN DEFAULT true,
  goal_inference BOOLEAN DEFAULT true,
  ai_full_history BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_consent_scopes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own consent scopes" ON user_consent_scopes;
CREATE POLICY "Users manage own consent scopes" ON user_consent_scopes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name IN (
        'journal_entries', 'user_goals', 'user_temporal_state',
        'escalation_events', 'moderation_events', 'explanation_feedback'
      )
      AND kcu.column_name = 'user_id'
      AND ccu.table_name = 'users'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
      rec.table_name, rec.constraint_name
    );
  END LOOP;
END $$;