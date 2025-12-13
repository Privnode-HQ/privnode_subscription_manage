# Environment Variables

This app uses **two completely independent relational databases**:

- `PLATFORM_DATABASE_URL`: the subscription-station DB (this app)
- `PRIVNODE_DATABASE_URL`: the Privnode API platform DB (used only for deploy/cancel/transfer)

## Required

- `APP_BASE_URL`
  - Example: `https://sub.example.com` or `http://localhost:5173`
- `SESSION_COOKIE_SECRET`
  - Used to sign session cookies.
  - Generate a long random string.
- `PLATFORM_DATABASE_URL`
  - Postgres connection string, e.g. `postgres://user:pass@localhost:5432/substation`
- `PRIVNODE_DATABASE_URL`
  - Connection string to Privnode DB.
  - Supported protocols:
    - Postgres: `postgres://user:pass@localhost:5432/privnode`
    - MySQL / MariaDB: `mysql://user:pass@localhost:3306/privnode`
- `REDEMPTION_CODE_JWT_SECRET`
  - Used to sign/verify JWT兑换码.
  - Generate a long random string.

## Stripe

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_API_VERSION` (optional, recommended)
- `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` (optional)

## Magic Link Email (optional in dev)

- `SMTP_URL`
  - Example: `smtp://user:pass@smtp.example.com:587`
- `MAGIC_LINK_FROM_EMAIL`
  - Example: `Privnode Subscriptions <no-reply@example.com>`

If SMTP is not configured, the magic-link URL is logged to server console.

## OIDC Providers (optional)

Set `OIDC_PROVIDERS_JSON` to a JSON string.

Example:

```json
[
  {
    "id": "google",
    "issuer": "https://accounts.google.com",
    "clientId": "...",
    "clientSecret": "...",
    "redirectUri": "https://sub.example.com/auth/oidc/google/callback",
    "scope": "openid email profile"
  }
]
```

## Admin (optional)

- `ADMIN_EMAILS`
  - Comma-separated list. Example: `admin@company.com,ops@company.com`
