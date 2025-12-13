import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name];
}

// Lazy getters so `react-router build` can run without a fully-configured env.
export const env = {
  // Primary (subscription-station) database.
  get PLATFORM_DATABASE_URL() {
    return required("PLATFORM_DATABASE_URL");
  },

  // Privnode database (separate database). Used only for deploy/cancel/transfer.
  get PRIVNODE_DATABASE_URL() {
    return required("PRIVNODE_DATABASE_URL");
  },

  get APP_BASE_URL() {
    return required("APP_BASE_URL");
  },
  get SESSION_COOKIE_NAME() {
    return optional("SESSION_COOKIE_NAME") ?? "psm_session";
  },
  get SESSION_COOKIE_SECRET() {
    return required("SESSION_COOKIE_SECRET");
  },

  get STRIPE_SECRET_KEY() {
    return required("STRIPE_SECRET_KEY");
  },
  get STRIPE_PUBLISHABLE_KEY() {
    return required("STRIPE_PUBLISHABLE_KEY");
  },
  get STRIPE_WEBHOOK_SECRET() {
    return required("STRIPE_WEBHOOK_SECRET");
  },
  // Optional. When set, pin Stripe API version for this server integration.
  // If unset, Stripe SDK defaults to your account's API version.
  get STRIPE_API_VERSION() {
    return optional("STRIPE_API_VERSION");
  },
  get STRIPE_BILLING_PORTAL_CONFIGURATION_ID() {
    return optional("STRIPE_BILLING_PORTAL_CONFIGURATION_ID");
  },

  // Magic link email
  get SMTP_URL() {
    return optional("SMTP_URL");
  },
  get MAGIC_LINK_FROM_EMAIL() {
    return optional("MAGIC_LINK_FROM_EMAIL");
  },

  // OIDC: JSON string of providers.
  // See docs/ENV.md
  get OIDC_PROVIDERS_JSON() {
    return optional("OIDC_PROVIDERS_JSON");
  },

  // Comma-separated emails to grant admin.
  get ADMIN_EMAILS() {
    return optional("ADMIN_EMAILS");
  },

  // JWT secret used to sign/verify redemption codes.
  // Generate a long random string.
  get REDEMPTION_CODE_JWT_SECRET() {
    return required("REDEMPTION_CODE_JWT_SECRET");
  },
} as const;
