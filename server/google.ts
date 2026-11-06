import crypto from "node:crypto";
import type { Request } from "express";
import { JWT_SECRET, getSettings, setSetting } from "./db.js";

/**
 * Google OAuth configuration.
 *
 * Credentials can come from two places, in this order:
 *   1. environment variables (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) — for servers;
 *   2. the database (`settings` table) — set by an administrator in the app itself,
 *      so the feature can be enabled from the hosted preview without shell access.
 *
 * The client secret is encrypted at rest with AES-256-GCM using a key derived from
 * the server's JWT secret, and is never sent back to the browser.
 */

const ENC_KEY = crypto.createHash("sha256").update(`google-oauth:${JWT_SECRET}`).digest();

const CLIENT_ID_RE = /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  enabled: boolean;
  source: "env" | "settings" | null;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${enc.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  try {
    const [version, iv, data, tag] = payload.split(".");
    if (version !== "v1" || !iv || !data || !tag) return "";
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

export function getGoogleConfig(): GoogleConfig {
  const envId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const envSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI ?? "").trim();

  if (envId && envSecret) {
    return { clientId: envId, clientSecret: envSecret, redirectUri, enabled: true, source: "env" };
  }

  const settings = getSettings();
  const storedId = (settings.google_client_id ?? "").trim();
  const storedSecret = decryptSecret(settings.google_client_secret_enc ?? "");
  const storedRedirect = (settings.google_redirect_uri ?? "").trim();
  if (storedId && storedSecret) {
    return {
      clientId: storedId,
      clientSecret: storedSecret,
      redirectUri: storedRedirect,
      enabled: true,
      source: "settings",
    };
  }

  return { clientId: "", clientSecret: "", redirectUri, enabled: false, source: null };
}

export class GoogleConfigError extends Error {}

/** Save credentials entered by an administrator (empty secret keeps the previous one). */
export function saveGoogleConfig(input: {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}) {
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  const redirectUri = (input.redirectUri ?? "").trim();

  if (!clientId) throw new GoogleConfigError("សូមបញ្ចូល Client ID ពី Google Cloud Console");
  if (!CLIENT_ID_RE.test(clientId)) {
    throw new GoogleConfigError(
      "Client ID មិនត្រឹមត្រូវ — ត្រូវបញ្ចប់ដោយ .apps.googleusercontent.com",
    );
  }
  if (clientSecret && clientSecret.length < 8) {
    throw new GoogleConfigError("Client Secret ខ្លីពេក — សូមចម្លងមកពី Google Cloud Console ទាំងស្រុង");
  }
  if (!clientSecret) {
    const current = decryptSecret(getSettings().google_client_secret_enc ?? "");
    if (!current) throw new GoogleConfigError("សូមបញ្ចូល Client Secret ផងដែរ");
  }

  if (redirectUri) {
    if (!/^https?:\/\/[^\s]+$/.test(redirectUri)) {
      throw new GoogleConfigError("Redirect URI មិនត្រឹមត្រូវ — ត្រូវចាប់ផ្ដើមដោយ https:// ឬ http://");
    }
    if (!redirectUri.endsWith("/api/auth/google/callback")) {
      throw new GoogleConfigError("Redirect URI ត្រូវបញ្ចប់ដោយ /api/auth/google/callback");
    }
  }

  setSetting("google_client_id", clientId);
  if (clientSecret) setSetting("google_client_secret_enc", encryptSecret(clientSecret));
  setSetting("google_redirect_uri", redirectUri);
}

export function clearGoogleConfig() {
  setSetting("google_client_id", "");
  setSetting("google_client_secret_enc", "");
  setSetting("google_redirect_uri", "");
}

export function maskClientId(clientId: string): string {
  if (!clientId) return "";
  const [local, domain] = clientId.split("@");
  if (domain) return `${local.slice(0, 6)}…@${domain}`;
  return clientId.length <= 14 ? clientId : `${clientId.slice(0, 10)}…${clientId.slice(-12)}`;
}

/** Absolute origin the browser is using (behind the preview proxy). */
export function publicBaseUrl(req: Request): string {
  const proto =
    String(req.headers["x-forwarded-proto"] ?? "")
      .split(",")[0]
      .trim() || req.protocol || "http";
  const host =
    String(req.headers["x-forwarded-host"] ?? "")
      .split(",")[0]
      .trim() || req.get("host") || `localhost:${process.env.PORT ?? 4173}`;
  return `${proto}://${host}`;
}

export function redirectUriFor(req: Request): string {
  return getGoogleConfig().redirectUri || `${publicBaseUrl(req)}/api/auth/google/callback`;
}
