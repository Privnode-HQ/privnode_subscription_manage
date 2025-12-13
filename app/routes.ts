import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("/", "routes/home.tsx"),
  route("/locale", "routes/locale.ts"),

  route("/login", "routes/auth/login.tsx"),
  route("/logout", "routes/auth/logout.tsx"),
  route("/auth/magic", "routes/auth/magic.tsx"),
  route("/auth/oidc/:provider", "routes/auth/oidc.start.tsx"),
  route("/auth/oidc/:provider/callback", "routes/auth/oidc.callback.tsx"),

  layout("routes/app/layout.tsx", [
    route("/app", "routes/app/index.tsx"),
    route("/app/plans", "routes/app/plans.tsx"),
    route("/app/subscribe/:planId", "routes/app/subscribe.$planId.tsx"),
    route("/app/subscriptions", "routes/app/subscriptions.tsx"),
    route("/app/redeem", "routes/app/redeem.tsx"),
    route("/app/billing-portal", "routes/app/billing-portal.tsx"),
    route("/app/admin/plans", "routes/app/admin.plans.tsx"),
    route(
      "/app/admin/redemption-codes",
      "routes/app/admin.redemption-codes.tsx"
    ),
  ]),

  route("/stripe/webhook", "routes/stripe/webhook.ts"),
] satisfies RouteConfig;
