import { Router } from "express";
import { db, audit } from "../db.js";
import {
  adminOnly,
  authRequired,
  hashPassword,
  signToken,
  verifyPassword,
  type AuthUser,
} from "../auth.js";
import { HttpError, asyncHandler } from "../util.js";

const router = Router();

/** Very small in-memory brute-force guard: 10 failed attempts per 10 minutes / IP. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) attempts.set(key, { count: 1, first: now });
  else entry.count++;
}

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!username || !password) throw new HttpError(400, "សូមបញ្ចូលឈ្មោះអ្នកប្រើ និងលេខសម្ងាត់");
    const attemptKey = `${req.ip ?? "unknown"}|${username}`;
    if (tooManyAttempts(attemptKey)) {
      throw new HttpError(429, "ព្យាយាមចូលច្រើនដងពេក សូមរង់ចាំ ១០ នាទី ហើយព្យាយាមម្ដងទៀត");
    }

    const user = db.prepare("SELECT * FROM users WHERE lower(username) = ?").get(username) as
      | {
          id: number;
          username: string;
          password_hash: string;
          name: string;
          role: "admin" | "teacher";
          subject_id: number | null;
          is_active: number;
        }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      registerFailure(attemptKey);
      throw new HttpError(401, "ឈ្មោះអ្នកប្រើ ឬលេខសម្ងាត់មិនត្រឹមត្រូវ");
    }
    attempts.delete(attemptKey);
    if (!user.is_active) throw new HttpError(403, "គណនីនេះត្រូវបានបិទ សូមទាក់ទងអ្នកគ្រប់គ្រង");

    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
    const payload: AuthUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      subject_id: user.subject_id,
    };
    audit(payload, "login", "user", user.id, `${user.name} បានចូលប្រើប្រាស់`, req.ip);
    res.json({ token: signToken(payload), user: payload });
  }),
);

router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

router.post(
  "/change-password",
  authRequired,
  asyncHandler(async (req, res) => {
    const current = String(req.body?.current_password ?? "");
    const next = String(req.body?.new_password ?? "");
    if (next.length < 6) throw new HttpError(400, "លេខសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ");
    const me = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as {
      password_hash: string;
    };
    if (!verifyPassword(current, me.password_hash)) throw new HttpError(400, "លេខសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវ");
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), req.user!.id);
    audit(req.user, "update", "user", req.user!.id, "បានផ្លាស់ប្ដូរលេខសម្ងាត់", req.ip);
    res.json({ ok: true });
  }),
);

router.get(
  "/users",
  authRequired,
  adminOnly,
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.username, u.name, u.name_en, u.role, u.email, u.phone, u.gender,
                u.subject_id, s.name_kh AS subject_name, u.hire_date, u.is_active, u.last_login_at, u.created_at
           FROM users u LEFT JOIN subjects s ON s.id = u.subject_id
          ORDER BY u.role, u.name`,
      )
      .all();
    res.json({ data: rows });
  }),
);

export default router;
