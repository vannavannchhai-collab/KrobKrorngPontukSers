import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { db, audit } from "../db.js";
import { signToken, hashPassword, type AuthUser } from "../auth.js";
import { HttpError, asyncHandler } from "../util.js";
import { getGoogleConfig, redirectUriFor } from "../google.js";

/**
 * Google OAuth 2.0 (Authorization Code + PKCE) — "ចូលប្រើដោយ Google".
 *
 * The flow is fully disabled until GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set,
 * so the app keeps working with e-mail + password accounts.
 */

const router = Router();

/** Accounts are Gmail-only, matching the product requirement. */
const GMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]{1,62})@(?:gmail\.com|googlemail\.com)$/;

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

const STATE_TTL_MS = 10 * 60 * 1000;
const CODE_TTL_MS = 2 * 60 * 1000;

interface PendingState {
  verifier: string;
  redirectUri: string;
  next: string;
  popup: boolean;
  createdAt: number;
}

interface PendingCode {
  token: string;
  user: AuthUser & { email: string | null };
  firstAccount: boolean;
  createdAt: number;
}

const pendingStates = new Map<string, PendingState>();
const pendingCodes = new Map<string, PendingCode>();

function config() {
  return getGoogleConfig();
}

function sweep() {
  const now = Date.now();
  for (const [k, v] of pendingStates) if (now - v.createdAt > STATE_TTL_MS) pendingStates.delete(k);
  for (const [k, v] of pendingCodes) if (now - v.createdAt > CODE_TTL_MS) pendingCodes.delete(k);
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Send the browser back to the login screen with a machine-readable error code. */
function fail(res: Response, code: string) {
  res.redirect(`/login?google_error=${encodeURIComponent(code)}`);
}

function sanitizeNext(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (body.error_description as string) || (body.error as string) || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body;
}

/* ---------------------------------------------------------------- status -- */

router.get("/google/status", (req, res) => {
  const { enabled } = config();
  const cfg = getGoogleConfig();
  res.json({
    enabled,
    source: cfg.source,
    redirect_uri: enabled ? redirectUriFor(req) : null,
    scope: "openid email profile",
    gmail_only: true,
  });
});

/* ----------------------------------------------------------------- start -- */

router.get("/google/start", (req, res) => {
  const { clientId, enabled } = config();
  if (!enabled) return fail(res, "not_configured");

  sweep();
  const state = base64url(crypto.randomBytes(24));
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const redirectUri = redirectUriFor(req);

  pendingStates.set(state, {
    verifier,
    redirectUri,
    next: sanitizeNext(req.query.next),
    popup: String(req.query.popup ?? "") === "1",
    createdAt: Date.now(),
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    access_type: "online",
    include_granted_scopes: "true",
  });

  res.setHeader("Cache-Control", "no-store");
  res.redirect(`${AUTH_ENDPOINT}?${params.toString()}`);
});

/* -------------------------------------------------------------- callback -- */

router.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const { clientId, clientSecret, enabled } = config();
    if (!enabled) return fail(res, "not_configured");

    if (req.query.error) return fail(res, "cancelled");

    const state = String(req.query.state ?? "");
    const code = String(req.query.code ?? "");
    const pending = pendingStates.get(state);
    pendingStates.delete(state);
    if (!pending || Date.now() - pending.createdAt > STATE_TTL_MS) return fail(res, "state");
    if (!code) return fail(res, "exchange");

    // 1. Exchange the authorization code (PKCE verifier proves it was our request).
    let tokens: Record<string, unknown>;
    try {
      tokens = await fetchJson(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: pending.redirectUri,
          grant_type: "authorization_code",
          code_verifier: pending.verifier,
        }).toString(),
      });
    } catch (err) {
      console.error("Google token exchange failed:", err);
      return fail(res, "exchange");
    }

    // 2. Read the verified profile.
    let profile: Record<string, unknown>;
    try {
      profile = await fetchJson(USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${String(tokens.access_token ?? "")}` },
      });
    } catch (err) {
      console.error("Google userinfo failed:", err);
      return fail(res, "profile");
    }

    const email = String(profile.email ?? "").trim().toLowerCase();
    const googleSub = String(profile.sub ?? "");
    const emailVerified = profile.email_verified === true || profile.verified_email === true;
    if (!email || !emailVerified) return fail(res, "unverified");
    if (!GMAIL_RE.test(email)) return fail(res, "gmail_required");

    // 3. Sign in an existing account or create one (respecting registration policy).
    const total = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
    const allowRow = db.prepare("SELECT value FROM settings WHERE key = 'allow_registration'").get() as
      | { value: string }
      | undefined;
    const registrationOpen = (allowRow?.value ?? "1") !== "0";

    let user = db
      .prepare("SELECT * FROM users WHERE lower(email) = ? OR lower(username) = ? LIMIT 1")
      .get(email, email) as
      | {
          id: number;
          username: string;
          name: string;
          role: "admin" | "teacher";
          subject_id: number | null;
          is_active: number;
          email: string | null;
        }
      | undefined;

    let firstAccount = false;
    let created = false;
    if (user) {
      if (!user.is_active) return fail(res, "disabled");
      db.prepare(
        "UPDATE users SET last_login_at = datetime('now'), google_sub = ?, email = COALESCE(email, ?) WHERE id = ?",
      ).run(googleSub, email, user.id);
    } else {
      if (total > 0 && !registrationOpen) return fail(res, "closed");
      const displayName = String(profile.name ?? "").trim() || email.split("@")[0];
      const role: "admin" | "teacher" = total === 0 ? "admin" : "teacher";
      // Random local password: the account can only be accessed through Google
      // until an administrator sets a password for it.
      const info = db
        .prepare(
          `INSERT INTO users (username, password_hash, name, role, email, google_sub, auth_provider, is_active)
           VALUES (?,?,?,?,?,?,'google',1)`,
        )
        .run(
          email,
          hashPassword(crypto.randomBytes(32).toString("hex")),
          displayName,
          role,
          email,
          googleSub,
        );
      const id = Number(info.lastInsertRowid);
      user = {
        id,
        username: email,
        name: displayName,
        role,
        subject_id: null,
        is_active: 1,
        email,
      };
      firstAccount = total === 0;
      created = true;
    }

    const payload: AuthUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      subject_id: user.subject_id,
    };
    const signed = signToken(payload);
    audit(
      payload,
      created ? "create" : "login",
      "user",
      user.id,
      `ចូលប្រើដោយ Google (${email})`,
      req.ip,
    );

    // 4. Hand the session to the SPA through a short-lived one-time code
    //    (keeps the JWT out of the URL / browser history).
    sweep();
    const oneTime = base64url(crypto.randomBytes(32));
    pendingCodes.set(oneTime, {
      token: signed,
      user: { ...payload, email },
      firstAccount,
      createdAt: Date.now(),
    });

    const suffix = pending.popup ? "&popup=1" : "";
    res.redirect(
      `/auth/google/callback?code=${encodeURIComponent(oneTime)}&next=${encodeURIComponent(pending.next)}${suffix}`,
    );
  }),
);

/* -------------------------------------------------------------- exchange -- */

router.post(
  "/google/exchange",
  asyncHandler(async (req, res) => {
    sweep();
    const code = String(req.body?.code ?? "").trim();
    const entry = pendingCodes.get(code);
    if (!entry || Date.now() - entry.createdAt > CODE_TTL_MS) {
      pendingCodes.delete(code);
      throw new HttpError(400, "សម័យចូលប្រើផុតកំណត់ សូមព្យាយាមម្ដងទៀត");
    }
    pendingCodes.delete(code);
    res.json({
      token: entry.token,
      user: entry.user,
      first_account: entry.firstAccount,
    });
  }),
);

export default router;
