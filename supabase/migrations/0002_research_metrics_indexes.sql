CREATE INDEX IF NOT EXISTS idx_escalation_events_user_created ON escalation_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_explanation_feedback_user_created ON explanation_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_feedback_created ON action_feedback(created_at DESC);