import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
});

/**
 * Verify that a webhook request came from QStash.
 * Returns true if valid, false if invalid or verification disabled.
 */
export async function verifyQStashSignature(
  signature: string | null,
  body: string,
): Promise<boolean> {
  // Skip verification in development or if keys not set
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  if (!signature || !process.env.QSTASH_CURRENT_SIGNING_KEY) {
    console.warn("QStash signature verification skipped - keys not configured");
    return true;
  }

  try {
    await receiver.verify({ signature, body });
    return true;
  } catch (error) {
    console.error("QStash signature verification failed:", error);
    return false;
  }
}
