import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server/app.js";
import { initSchema } from "../server/db.js";

/**
 * Vercel serverless entry point.
 *
 * All `/api/*` requests are handled by this single function (see `vercel.json`).
 * The schema is created lazily on the first request of each cold start — it is
 * idempotent, so concurrent instances are safe.
 */
const app = createApp();

let ready: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!ready) {
    ready = initSchema().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await ensureReady();
  } catch (err) {
    console.error("❌ Database init failed:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error:
          "មិនអាចភ្ជាប់ទៅ database បានទេ — សូមពិនិត្យ TURSO_DATABASE_URL និង TURSO_AUTH_TOKEN",
      }),
    );
    return;
  }
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
