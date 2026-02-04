import type { Context } from "elysia";
import { verifyQStashSignature } from "../qstash/verify";
import { cleanupStaleReminders } from "../cleanup";

export const webhookCleanupRoute = async ({ request, body, set }: Context) => {
  const signature = request.headers.get("upstash-signature");
  const rawBody = JSON.stringify(body);

  const isValid = await verifyQStashSignature(signature, rawBody);
  if (!isValid) {
    console.log("Invalid QStash signature on cleanup webhook");
    set.status = 401;
    return { error: "Invalid signature" };
  }

  console.log("Monthly cleanup triggered via webhook");
  const result = cleanupStaleReminders();

  return { status: "ok", ...result };
};
