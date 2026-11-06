import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET, db } from "./db.js";

export type Role = "admin" | "teacher";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  subject_id: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "12h" });
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "សូមចូលប្រើប្រាស់ជាមុន" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & AuthUser;
    req.user = {
      id: payload.id,
      username: payload.username,
      name: payload.name,
      role: payload.role,
      subject_id: payload.subject_id ?? null,
    };
    // Verify the account still exists and is enabled.
    const row = db.prepare("SELECT is_active FROM users WHERE id = ?").get(req.user.id) as
      | { is_active: number }
      | undefined;
    if (!row || !row.is_active) return res.status(401).json({ error: "គណនីត្រូវបានបិទ" });
    next();
  } catch {
    return res.status(401).json({ error: "សម័យប្រើប្រាស់បានផុតកំណត់ សូមចូលម្ដងទៀត" });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "អ្នកគ្មានសិទ្ធិធ្វើប្រតិបត្តិការនេះទេ" });
  }
  next();
}

/** Teachers may only touch the classes/subjects assigned to them. */
export function canEditSubject(classId: number, subjectId: number, user: AuthUser): boolean {
  if (user.role === "admin") return true;
  const row = db
    .prepare("SELECT 1 FROM class_subjects WHERE class_id = ? AND subject_id = ? AND teacher_id = ?")
    .get(classId, subjectId, user.id);
  return !!row;
}

export function canEditClass(classId: number, user: AuthUser): boolean {
  if (user.role === "admin") return true;
  const homeroom = db
    .prepare("SELECT 1 FROM classes WHERE id = ? AND homeroom_teacher_id = ?")
    .get(classId, user.id);
  if (homeroom) return true;
  const assigned = db
    .prepare("SELECT 1 FROM class_subjects WHERE class_id = ? AND teacher_id = ?")
    .get(classId, user.id);
  return !!assigned;
}
