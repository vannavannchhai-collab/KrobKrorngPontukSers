import "./env.js";
import express, { type Express } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { HttpError } from "./util.js";
import { getGoogleConfig } from "./google.js";

import authRoutes from "./routes/auth.js";
import googleAuthRoutes from "./routes/googleAuth.js";
import academicsRoutes from "./routes/academics.js";
import studentsRoutes from "./routes/students.js";
import scoresRoutes from "./routes/scores.js";
import resultsRoutes from "./routes/results.js";
import attendanceRoutes from "./routes/attendance.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

/** True when running as a Vercel serverless function. */
export const IS_SERVERLESS = Boolean(process.env.VERCEL);

/**
 * Builds the Express application.
 * The same app is used by the standalone server (`server/index.ts`) and by the
 * Vercel function (`api/[...path].ts`), so behaviour stays identical.
 */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: true, limit: "8mb" }));

  // Basic security headers (kept permissive enough for the preview iframe).
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.get("/api/health", async (_req, res) => {
    const google = await getGoogleConfig();
    res.json({
      ok: true,
      time: new Date().toISOString(),
      version: "1.0.0",
      database: process.env.TURSO_DATABASE_URL ? "libsql" : "sqlite-file",
      google_oauth: google.enabled ? `enabled (${google.source})` : "disabled",
    });
  });

  app.use("/api/auth", googleAuthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api", academicsRoutes);
  app.use("/api/students", studentsRoutes);
  app.use("/api/scores", scoresRoutes);
  app.use("/api/results", resultsRoutes);
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/admin", adminRoutes);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "រកមិនឃើញចំណុចបញ្ជា (API endpoint) នេះ" });
  });

  // Static client + SPA fallback (not used on Vercel: the CDN serves `dist/`).
  if (!IS_SERVERLESS) {
    const distDir = path.join(ROOT, "dist");
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir, { index: false, maxAge: "1h" }));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distDir, "index.html"));
      });
    } else {
      app.get("*", (_req, res) => {
        res
          .status(200)
          .type("html")
          .send(
            `<!doctype html><html lang="km"><meta charset="utf-8"><title>KrobKrorng Pontuk Sers</title>
             <body style="font-family:sans-serif;padding:40px;line-height:1.7">
             <h1>ប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស</h1>
             <p>មិនទាន់មានឯកសារ build ទេ។ សូមរត់ <code>npm run build</code> ជាមុនសិន។</p></body></html>`,
          );
      });
    }
  }

  // Error handler
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
      }
      const message = err instanceof Error ? err.message : "មានបញ្ហាមិនស្គាល់";
      console.error("❌", err);
      res.status(500).json({ error: `មានបញ្ហាក្នុងប្រព័ន្ធ: ${message}` });
    },
  );

  return app;
}
