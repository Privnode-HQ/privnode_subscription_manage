import { createContext, useContext, useMemo } from "react";

export type Locale = "en" | "zh";

export const supportedLocales: readonly Locale[] = ["en", "zh"] as const;

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh";
}

export function localeToHtmlLang(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en";
}

type Dict = Record<string, string>;

const translations: Record<Locale, Dict> = {
  en: {
    "app.brand": "Privnode / Subscription Station",

    "locale.label": "Language",
    "locale.en": "English",
    "locale.zh": "中文",

    "nav.dashboard": "Dashboard",
    "nav.plans": "Plans",
    "nav.subscriptions": "Subscriptions",
    "nav.redeem": "Redeem",
    "nav.billingPortal": "Billing Portal",
    "nav.adminPlans": "Admin: Plans",
    "nav.adminRedeemCodes": "Admin: Redeem Codes",

    "auth.logout": "Logout",

    "login.title": "Sign in",
    "login.subtitle": "Magic Link (Email) or OIDC.",
    "login.email": "Email",
    "login.emailPlaceholder": "you@company.com",
    "login.sendMagicLink": "Send Magic Link",
    "login.magicLinkHint": "If the email exists / can receive mail, you will get a sign-in link.",
    "login.devLink": "Dev link:",
    "login.oidc": "OIDC",
    "login.continueWith": "Continue with {{provider}}",

    "dashboard.title": "Dashboard",
    "dashboard.blurb": "This system sells and manages subscription bundles.",

    "plans.title": "Plans",
    "plans.blurb": "You buy monthly subscription bundles here.",
    "plans.limit5h": "5h rolling window: ${{units}}",
    "plans.limit7d": "7d rolling window: ${{units}}",
    "plans.subscribe": "Subscribe",
    "plans.none": "No active plans.",

    "subscribe.title": "Subscribe",
    "subscribe.createSubscription": "Create subscription",
    "subscribe.creating": "Creating…",
    "subscribe.backToPlans": "Back to plans",
    "subscribe.summary": "5h: ${{limit5h}} · 7d: ${{limit7d}}",

    "payment.title": "Payment",
    "payment.confirming": "Confirming…",
    "payment.confirm": "Confirm payment",
    "payment.failed": "Payment failed",

    "subscriptions.title": "Subscriptions",
    "subscriptions.blurb":
      "Deploy/cancel/transfer updates Privnode subscription. ",
    "subscriptions.headers.subscriptionId": "subscription_id",
    "subscriptions.headers.plan": "plan",
    "subscriptions.headers.stripeStatus": "stripe_status",
    "subscriptions.headers.autoRenew": "auto_renew",
    "subscriptions.headers.periodEnd": "period_end",
    "subscriptions.headers.deployStatus": "deploy_status",
    "subscriptions.headers.privnodeTarget": "privnode_target",
    "subscriptions.headers.limit5hAvail": "5h_available",
    "subscriptions.headers.limit7dAvail": "7d_available",
    "subscriptions.headers.actions": "actions",
    "subscriptions.deploy": "Deploy",
    "subscriptions.transfer": "Transfer",
    "subscriptions.deactivate": "Deactivate",
    "subscriptions.deployPlaceholder": "Privnode id or username",
    "subscriptions.transferPlaceholder": "Transfer to id/username",
    "subscriptions.waitStripeActive": "Wait until Stripe subscription is active",
    "subscriptions.none": "No subscriptions yet.",
    "subscriptions.msgDeployed": "Deployed to {{username}} ({{userId}})",
    "subscriptions.msgTransferred": "Transferred to {{username}} ({{userId}})",
    "subscriptions.msgDeactivated": "Deactivated (quota preserved)",
    "subscriptions.search": "Search",
    "subscriptions.searchPlaceholder": "Search by ID, plan, or username",
    "subscriptions.filterAll": "All",
    "subscriptions.showing": "Showing {{count}} of {{total}} subscriptions",
    "subscriptions.noResults": "No subscriptions match your filters.",

    "redeem.title": "Redeem Code",
    "redeem.blurb": "Paste the redemption code to redeem a subscription.",
    "redeem.placeholder": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "redeem.button": "Redeem",
    "redeem.alreadyRedeemed": "Already redeemed",
    "redeem.redeemed": "Redeemed",
    "redeem.goSubscriptions": "Go to Subscriptions",

    "billing.title": "Stripe Billing Portal",
    "billing.blurb":
      "Manage payment method, invoices, cancel/resume auto-renew.",
    "billing.open": "Open Billing Portal",
    "billing.noCustomer": "No Stripe customer yet. Purchase a plan first.",

    "adminPlans.title": "Admin: Plans",
    "adminPlans.blurb": "`pln_` is platform-generated. Stripe IDs are stored separately.",
    "adminPlans.createTitle": "Create Plan",
    "adminPlans.namePlaceholder": "Plan name",
    "adminPlans.descPlaceholder": "Description",
    "adminPlans.limit5hPlaceholder": "5h quota",
    "adminPlans.limit7dPlaceholder": "7d quota",
    "adminPlans.active": "Active",
    "adminPlans.create": "Create",
    "adminPlans.created": "Created {{planId}}",
    "adminPlans.existing": "Existing Plans",
    "adminPlans.headers.planId": "plan_id",
    "adminPlans.headers.name": "name",
    "adminPlans.headers.limit5h": "5h",
    "adminPlans.headers.limit7d": "7d",
    "adminPlans.headers.stripePriceId": "stripe_price_id",
    "adminPlans.headers.active": "active",

    "adminRedemption.title": "Admin: Redemption Codes",
    "adminRedemption.blurb":
      "Generates JWT redemption codes. Users can redeem them to create a manual subscription.",
    "adminRedemption.generate": "Generate",
    "adminRedemption.plan": "Plan",
    "adminRedemption.durationDays": "Duration (days)",
    "adminRedemption.maxUses": "Max uses",
    "adminRedemption.expiresInDays": "Expires in (days)",
    "adminRedemption.override5h": "Override 5h units (optional)",
    "adminRedemption.override7d": "Override 7d units (optional)",
    "adminRedemption.overridePlanName": "Override plan name (optional)",
    "adminRedemption.overrideDesc": "Override description (optional)",
    "adminRedemption.generated": "Generated: {{jti}}",
    "adminRedemption.shareHint": "Share this JWT to the user to redeem.",
    "adminRedemption.recent": "Recent Codes",
    "adminRedemption.headers.jti": "jti",
    "adminRedemption.headers.plan": "plan",
    "adminRedemption.headers.duration": "duration",
    "adminRedemption.headers.uses": "uses",
    "adminRedemption.headers.expires": "expires",
    "adminRedemption.headers.custom": "custom",

    "common.yes": "yes",
    "common.no": "no",

    "error.oops": "Oops!",
    "error.unexpected": "An unexpected error occurred.",
    "error.error": "Error",
    "error.notFound": "The requested page could not be found.",

    // Known error codes
    "error.token_required": "Token is required.",
    "error.plan_not_found": "Plan not found.",
    "error.subscription_not_found": "Subscription not found.",
    "error.missing_current_period_end": "Missing current period end.",
    "error.not_deployable_until_subscription_active": "Not deployable until subscription is active.",
    "error.not_transferable_until_subscription_active": "Not transferable until subscription is active.",
    "error.privnode_identifier_required": "Privnode identifier is required.",
    "error.privnode_user_not_found": "Privnode user not found.",
    "error.use_transfer_for_different_target": "Use transfer when targeting a different user.",
    "error.already_deployed": "Already deployed.",
    "error.not_deployed": "Not deployed.",
    "error.unknown_intent": "Unknown intent.",

    "error.name_required": "Name is required.",
    "error.limit_5h_units_invalid": "Invalid 5h units.",
    "error.limit_7d_units_invalid": "Invalid 7d units.",
    "error.stripe_product_id_invalid": "Invalid Stripe product id.",
    "error.stripe_price_id_invalid": "Invalid Stripe price id.",

    "error.plan_id_invalid": "Invalid plan_id.",
    "error.duration_days_invalid": "Invalid duration_days.",
    "error.max_uses_invalid": "Invalid max_uses.",
    "error.expires_in_days_invalid": "Invalid expires_in_days.",
    "error.custom_limit_5h_units_invalid": "Invalid override 5h units.",
    "error.custom_limit_7d_units_invalid": "Invalid override 7d units.",
  },

  zh: {
    "app.brand": "Privnode / 订阅管理",

    "locale.label": "语言",
    "locale.en": "English",
    "locale.zh": "中文",

    "nav.dashboard": "控制台",
    "nav.plans": "套餐",
    "nav.subscriptions": "订阅",
    "nav.redeem": "兑换",
    "nav.billingPortal": "账单门户",
    "nav.adminPlans": "管理：套餐",
    "nav.adminRedeemCodes": "管理：兑换码",

    "auth.logout": "退出登录",

    "login.title": "登录",
    "login.subtitle": "邮箱魔法链接（Magic Link）或 OIDC。",
    "login.email": "邮箱",
    "login.emailPlaceholder": "you@company.com",
    "login.sendMagicLink": "发送登录链接",
    "login.magicLinkHint": "如果该邮箱存在且可收信，你将收到一封登录链接邮件。",
    "login.devLink": "开发环境链接：",
    "login.oidc": "OIDC",
    "login.continueWith": "使用 {{provider}} 继续",

    "dashboard.title": "控制台",
    "dashboard.blurb": "本系统用于售卖与管理订阅套餐。",

    "plans.title": "套餐",
    "plans.blurb": "在此购买月度订阅套餐。",
    "plans.limit5h": "5 小时滚动窗口：${{units}}",
    "plans.limit7d": "7 天滚动窗口：${{units}}",
    "plans.subscribe": "订阅",
    "plans.none": "暂无可用套餐。",

    "subscribe.title": "订阅",
    "subscribe.createSubscription": "创建订阅",
    "subscribe.creating": "创建中…",
    "subscribe.backToPlans": "返回套餐列表",
    "subscribe.summary": "5 小时：${{limit5h}} · 7 天：${{limit7d}}",

    "payment.title": "支付",
    "payment.confirming": "确认中…",
    "payment.confirm": "确认支付",
    "payment.failed": "支付失败",

    "subscriptions.title": "订阅",
    "subscriptions.blurb":
      "部署/取消/转移会更新 Privnode 订阅。",
    "subscriptions.headers.subscriptionId": "订阅 ID",
    "subscriptions.headers.plan": "套餐",
    "subscriptions.headers.stripeStatus": "Stripe 状态",
    "subscriptions.headers.autoRenew": "自动续订",
    "subscriptions.headers.periodEnd": "到期时间",
    "subscriptions.headers.deployStatus": "部署状态",
    "subscriptions.headers.privnodeTarget": "Privnode 目标",
    "subscriptions.headers.limit5hAvail": "5 小时可用",
    "subscriptions.headers.limit7dAvail": "7 天可用",
    "subscriptions.headers.actions": "操作",
    "subscriptions.deploy": "部署",
    "subscriptions.transfer": "转移",
    "subscriptions.deactivate": "停用",
    "subscriptions.deployPlaceholder": "Privnode ID 或用户名",
    "subscriptions.transferPlaceholder": "转移到 ID/用户名",
    "subscriptions.waitStripeActive": "请等待 Stripe 订阅变为激活状态",
    "subscriptions.none": "暂无订阅。",
    "subscriptions.msgDeployed": "已部署到 {{username}}（{{userId}}）",
    "subscriptions.msgTransferred": "已转移到 {{username}}（{{userId}}）",
    "subscriptions.msgDeactivated": "已停用（额度保留）",
    "subscriptions.search": "搜索",
    "subscriptions.searchPlaceholder": "搜索 ID、套餐或用户名",
    "subscriptions.filterAll": "全部",
    "subscriptions.showing": "显示 {{count}} / {{total}} 个订阅",
    "subscriptions.noResults": "没有符合筛选条件的订阅。",

    "redeem.title": "兑换码",
    "redeem.blurb": "粘贴兑换码以创建订阅。",
    "redeem.placeholder": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "redeem.button": "兑换",
    "redeem.alreadyRedeemed": "已兑换过",
    "redeem.redeemed": "兑换成功",
    "redeem.goSubscriptions": "前往订阅列表",

    "billing.title": "Stripe 账单门户",
    "billing.blurb":
      "管理支付方式、发票，以及取消/恢复自动续订。",
    "billing.open": "打开账单门户",
    "billing.noCustomer": "尚未创建 Stripe 客户。请先购买套餐。",

    "adminPlans.title": "管理：套餐",
    "adminPlans.blurb": "`pln_` 由平台生成。Stripe ID 单独存储。",
    "adminPlans.createTitle": "创建套餐",
    "adminPlans.namePlaceholder": "套餐名称",
    "adminPlans.descPlaceholder": "描述",
    "adminPlans.limit5hPlaceholder": "5 小时额度",
    "adminPlans.limit7dPlaceholder": "7 天额度",
    "adminPlans.active": "启用",
    "adminPlans.create": "创建",
    "adminPlans.created": "已创建 {{planId}}",
    "adminPlans.existing": "已有套餐",
    "adminPlans.headers.planId": "plan_id",
    "adminPlans.headers.name": "名称",
    "adminPlans.headers.limit5h": "5 小时",
    "adminPlans.headers.limit7d": "7 天",
    "adminPlans.headers.stripePriceId": "stripe_price_id",
    "adminPlans.headers.active": "启用",

    "adminRedemption.title": "管理：兑换码",
    "adminRedemption.blurb": "生成 JWT 兑换码。用户可用其创建手动订阅。",
    "adminRedemption.generate": "生成",
    "adminRedemption.plan": "套餐",
    "adminRedemption.durationDays": "时长（天）",
    "adminRedemption.maxUses": "最大使用次数",
    "adminRedemption.expiresInDays": "有效期（天）",
    "adminRedemption.override5h": "覆盖 5 小时单位（可选）",
    "adminRedemption.override7d": "覆盖 7 天单位（可选）",
    "adminRedemption.overridePlanName": "覆盖套餐名称（可选）",
    "adminRedemption.overrideDesc": "覆盖描述（可选）",
    "adminRedemption.generated": "已生成：{{jti}}",
    "adminRedemption.shareHint": "将此 JWT 发给用户用于兑换。",
    "adminRedemption.recent": "最近生成",
    "adminRedemption.headers.jti": "jti",
    "adminRedemption.headers.plan": "套餐",
    "adminRedemption.headers.duration": "时长",
    "adminRedemption.headers.uses": "使用次数",
    "adminRedemption.headers.expires": "过期时间",
    "adminRedemption.headers.custom": "自定义",

    "common.yes": "是",
    "common.no": "否",

    "error.oops": "出错了！",
    "error.unexpected": "发生了一个未预期的错误。",
    "error.error": "错误",
    "error.notFound": "未找到请求的页面。",

    // Known error codes
    "error.token_required": "请输入兑换码。",
    "error.plan_not_found": "未找到该套餐。",
    "error.subscription_not_found": "未找到该订阅。",
    "error.missing_current_period_end": "缺少订阅到期时间。",
    "error.not_deployable_until_subscription_active": "订阅未激活，暂不可部署。",
    "error.not_transferable_until_subscription_active": "订阅未激活，暂不可转移。",
    "error.privnode_identifier_required": "请输入 Privnode ID 或用户名。",
    "error.privnode_user_not_found": "未找到对应的 Privnode 用户。",
    "error.use_transfer_for_different_target": "目标用户不同，请使用“转移”。",
    "error.already_deployed": "已部署，无需重复操作。",
    "error.not_deployed": "尚未部署。",
    "error.unknown_intent": "未知操作。",

    "error.name_required": "请输入名称。",
    "error.limit_5h_units_invalid": "5 小时单位不合法。",
    "error.limit_7d_units_invalid": "7 天单位不合法。",
    "error.stripe_product_id_invalid": "Stripe product id 不合法。",
    "error.stripe_price_id_invalid": "Stripe price id 不合法。",

    "error.plan_id_invalid": "plan_id 不合法。",
    "error.duration_days_invalid": "duration_days 不合法。",
    "error.max_uses_invalid": "max_uses 不合法。",
    "error.expires_in_days_invalid": "expires_in_days 不合法。",
    "error.custom_limit_5h_units_invalid": "覆盖 5 小时单位不合法。",
    "error.custom_limit_7d_units_invalid": "覆盖 7 天单位不合法。",
  },
};

export type TFunction = (
  key: string,
  vars?: Record<string, string | number | boolean | null | undefined>
) => string;

export function createT(locale: Locale): TFunction {
  const dict = translations[locale] ?? translations.en;
  return (key, vars) => {
    const template = dict[key] ?? translations.en[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => {
      const raw = vars[name];
      return raw == null ? "" : String(raw);
    });
  };
}

type I18nValue = {
  locale: Locale;
  t: TFunction;
};

const I18nContext = createContext<I18nValue>({
  locale: "en",
  t: createT("en"),
});

export function I18nProvider(props: { locale: Locale; children: React.ReactNode }) {
  const t = useMemo(() => createT(props.locale), [props.locale]);
  const value = useMemo(() => ({ locale: props.locale, t }), [props.locale, t]);
  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function formatError(t: TFunction, code: string): string {
  const key = `error.${code}`;
  const translated = t(key);
  return translated === key ? code : translated;
}
