-- Velo (AI travel agent): messages used today, for the daily allowance.
ALTER TABLE users ADD COLUMN ai_day DATE;
ALTER TABLE users ADD COLUMN ai_count INTEGER NOT NULL DEFAULT 0;
