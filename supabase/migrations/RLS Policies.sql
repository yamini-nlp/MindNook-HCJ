ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own entries" ON journal_entries;
DROP POLICY IF EXISTS "Users insert own entries" ON journal_entries;
DROP POLICY IF EXISTS "Users update own entries" ON journal_entries;
DROP POLICY IF EXISTS "Users delete own entries" ON journal_entries;
CREATE POLICY "Users see own entries" ON journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own entries" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own entries" ON journal_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own entries" ON journal_entries FOR DELETE USING (auth.uid() = user_id);