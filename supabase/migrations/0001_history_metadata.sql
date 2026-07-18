ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS metadata JSONB;
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_created ON journal_entries(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION get_user_history(uid UUID, lim INT DEFAULT 50)
RETURNS TABLE(x BIGINT, t TIMESTAMPTZ, s FLOAT, m JSONB, entry JSONB) AS $$
  SELECT
    je.id AS x,
    je.created_at AS t,
    je.sentiment_score AS s,
    COALESCE(je.metadata, '{}'::jsonb) AS m,
    to_jsonb(je) AS entry
  FROM journal_entries je
  WHERE je.user_id = uid AND uid = auth.uid()
  ORDER BY je.created_at DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_user_history(UUID, INT) TO authenticated;