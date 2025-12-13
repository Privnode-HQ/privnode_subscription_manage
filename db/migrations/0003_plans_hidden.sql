-- Add plan visibility control (hide from user-facing plan list)

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

