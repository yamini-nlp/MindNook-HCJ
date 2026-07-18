ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS layer2_pragmatic JSONB;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS layer3_temporal JSONB;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS layer4_goal JSONB;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS layer5_action JSONB;

CREATE INDEX IF NOT EXISTS idx_l2 ON journal_entries USING GIN (layer2_pragmatic);
CREATE INDEX IF NOT EXISTS idx_l3 ON journal_entries USING GIN (layer3_temporal);
CREATE INDEX IF NOT EXISTS idx_created ON journal_entries (created_at DESC);