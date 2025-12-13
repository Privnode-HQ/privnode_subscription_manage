-- Redemption codes (JWT-based)

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS redeemed_code_jti TEXT,
  ADD COLUMN IF NOT EXISTS custom_plan_name TEXT,
  ADD COLUMN IF NOT EXISTS custom_plan_description TEXT,
  ADD COLUMN IF NOT EXISTS custom_limit_5h_units INTEGER CHECK (custom_limit_5h_units IS NULL OR custom_limit_5h_units >= 0),
  ADD COLUMN IF NOT EXISTS custom_limit_7d_units INTEGER CHECK (custom_limit_7d_units IS NULL OR custom_limit_7d_units >= 0);

CREATE INDEX IF NOT EXISTS subscriptions_redeemed_code_jti_idx ON subscriptions(redeemed_code_jti);

CREATE TABLE IF NOT EXISTS redemption_codes (
  jti TEXT PRIMARY KEY,
  created_by_user_id BIGINT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL REFERENCES plans(plan_id),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  max_uses INTEGER NOT NULL CHECK (max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0 AND used_count <= max_uses),
  expires_at TIMESTAMPTZ NOT NULL,

  custom_plan_name TEXT,
  custom_plan_description TEXT,
  custom_limit_5h_units INTEGER CHECK (custom_limit_5h_units IS NULL OR custom_limit_5h_units >= 0),
  custom_limit_7d_units INTEGER CHECK (custom_limit_7d_units IS NULL OR custom_limit_7d_units >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_redeemed_code_jti_fkey
  FOREIGN KEY (redeemed_code_jti) REFERENCES redemption_codes(jti);

CREATE TABLE IF NOT EXISTS redemption_code_redemptions (
  id BIGSERIAL PRIMARY KEY,
  jti TEXT NOT NULL REFERENCES redemption_codes(jti) ON DELETE CASCADE,
  redeemed_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(subscription_id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (jti, redeemed_by_user_id),
  UNIQUE (subscription_id)
);
