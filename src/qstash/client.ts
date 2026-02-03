import { Client } from "@upstash/qstash";

if (!process.env.QSTASH_TOKEN) {
  console.warn("QSTASH_TOKEN not set - QStash scheduling disabled");
}

export const qstash = process.env.QSTASH_TOKEN
  ? new Client({ token: process.env.QSTASH_TOKEN })
  : null;

/**
 * Get the base URL for webhook callbacks.
 * In production, this is your Render URL.
 * In development, you'll need a tunnel (ngrok, localtunnel, etc.)
 */
export function getWebhookBaseUrl(): string {
  if (process.env.WEBHOOK_BASE_URL) {
    return process.env.WEBHOOK_BASE_URL;
  }

  // Default for local development
  return `http://localhost:${process.env.PORT || 8080}`;
}
