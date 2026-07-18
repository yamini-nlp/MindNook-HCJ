ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS hyperbole_flag boolean DEFAULT false;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS hyperbole_score float;