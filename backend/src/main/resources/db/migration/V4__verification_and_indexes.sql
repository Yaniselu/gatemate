-- E-mail verification codes (one active code per account, stored hashed).
CREATE TABLE email_verifications (
    user_id     UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    code_hash   VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0
);

-- Indexes for the queries the app runs on every screen.
CREATE INDEX IF NOT EXISTS ix_trip_members_user ON trip_members (user_id);
CREATE INDEX IF NOT EXISTS ix_trips_owner ON trips (owner_id);
CREATE INDEX IF NOT EXISTS ix_flights_claimed_by ON flights (claimed_by);
CREATE INDEX IF NOT EXISTS ix_checklist_trip ON checklist_items (trip_id, position);
CREATE INDEX IF NOT EXISTS ix_expenses_trip ON expenses (trip_id, created_at);
CREATE INDEX IF NOT EXISTS ix_chat_members_user ON chat_members (user_id);
CREATE INDEX IF NOT EXISTS ix_chat_threads_trip ON chat_threads (trip_id);
CREATE INDEX IF NOT EXISTS ix_password_resets_user ON password_resets (user_id);
CREATE INDEX IF NOT EXISTS ix_reports_status ON reports (status, created_at);
CREATE INDEX IF NOT EXISTS ix_push_tokens_user ON push_tokens (user_id);
CREATE INDEX IF NOT EXISTS ix_alerts_flight ON alerts (flight_id);
