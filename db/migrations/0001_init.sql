-- Platform DB schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oidc_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_id, subject)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS oidc_states (
  state TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  plan_id TEXT PRIMARY KEY CHECK (plan_id ~ '^pln_[0-9A-Za-z]{16}$'),
  name TEXT NOT NULL,
  description TEXT,
  limit_5h_units INTEGER NOT NULL CHECK (limit_5h_units >= 0),
  limit_7d_units INTEGER NOT NULL CHECK (limit_7d_units >= 0),
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS plans_stripe_price_id_idx ON plans(stripe_price_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id TEXT PRIMARY KEY CHECK (subscription_id ~ '^sub_[0-9A-Za-z]{16}$'),
  buyer_user_id BIGINT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL REFERENCES plans(plan_id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_status TEXT,
  auto_renew_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  current_period_end BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ordered_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS deployments (
  id BIGSERIAL PRIMARY KEY,
  subscription_id TEXT NOT NULL UNIQUE REFERENCES subscriptions(subscription_id) ON DELETE CASCADE,
  privnode_user_id BIGINT,
  privnode_username TEXT,
  status TEXT NOT NULL CHECK (status IN ('ordered','deploying','deployed','deactivated','disabled','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deployed_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  transferred_at TIMESTAMPTZ
);

-- Keep deployments.updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deployments_set_updated_at ON deployments;
CREATE TRIGGER deployments_set_updated_at
BEFORE UPDATE ON deployments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id),
  action TEXT NOT NULL,
  subject_subscription_id TEXT,
  subject_plan_id TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
