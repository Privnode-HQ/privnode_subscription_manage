import { handleStripeWebhookRequest } from "../../lib/server/stripe/webhook.server";

export async function action({ request }: { request: Request }) {
  return handleStripeWebhookRequest(request);
}
