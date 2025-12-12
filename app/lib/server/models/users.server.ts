import { getStripe } from "../stripe.server";
import { getPlatformPool, withPlatformTx } from "../db.server";

export async function getUserStripeCustomerId(userId: number): Promise<string | null> {
  const pool = getPlatformPool();
  const res = await pool.query(
    "SELECT stripe_customer_id FROM users WHERE id = $1 LIMIT 1",
    [userId]
  );
  return (res.rows[0]?.stripe_customer_id as string | null | undefined) ?? null;
}

export async function ensureStripeCustomer(params: {
  userId: number;
  email: string;
}): Promise<string> {
  const existing = await getUserStripeCustomerId(params.userId);
  if (existing) return existing;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: params.email,
    metadata: {
      platform_user_id: String(params.userId),
    },
  });

  await withPlatformTx(async (tx) => {
    await tx.query(
      "UPDATE users SET stripe_customer_id = $1 WHERE id = $2 AND stripe_customer_id IS NULL",
      [customer.id, params.userId]
    );
  });

  // Re-read to avoid races.
  const finalId = await getUserStripeCustomerId(params.userId);
  return finalId ?? customer.id;
}
