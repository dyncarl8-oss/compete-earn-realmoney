import { WhopServerSdk, makeWebhookValidator } from "@whop/api";

const apiKey = process.env.WHOP_API_KEY;
const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;

if (!apiKey) {
  throw new Error("WHOP_API_KEY environment variable is required");
}

if (!appId) {
  throw new Error("NEXT_PUBLIC_WHOP_APP_ID environment variable is required");
}

// Log SDK initialization (masked for security)
console.log("🔑 Whop App Key loaded:", apiKey ? "yes" : "no");
console.log("📱 Whop App ID loaded:", appId ? "yes" : "no");

export const whopSdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

// Create webhook validator for secure webhook verification
const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;
if (!webhookSecret) {
  console.warn("⚠️ WHOP_WEBHOOK_SECRET not set - webhook validation disabled");
}

export const validateWebhook = webhookSecret ? makeWebhookValidator({ webhookSecret }) : null;