import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");
export const DATA_DIR = path.join(ROOT, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "school.db");

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

/** Persistent JWT secret so sessions survive a restart. */
export const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const secretFile = path.join(DATA_DIR, ".jwt-secret");
  if (fs.existsSync(secretFile)) return fs.readFileSync(secretFile, "utf8").trim();
  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  return secret;
})();

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_years (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      start_date TEXT,
      end_date   TEXT,
      is_current INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS terms (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      name             TEXT NOT NULL,
      semester         INTEGER NOT NULL,
      start_date       TEXT,
      end_date         TEXT,
      is_current       INTEGER NOT NULL DEFAULT 0,
      UNIQUE (academic_year_id, semester)
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      name_en       TEXT,
      role          TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('admin','teacher')),
      email         TEXT,
      phone         TEXT,
      gender        TEXT,
      subject_id    INTEGER,
      hire_date     TEXT,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      code      TEXT NOT NULL UNIQUE,
      name_kh   TEXT NOT NULL,
      name_en   TEXT NOT NULL,
      credits   REAL NOT NULL DEFAULT 1,
      color     TEXT NOT NULL DEFAULT '#4f46e5',
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS classes (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      name                TEXT NOT NULL,
      grade_level         INTEGER NOT NULL,
      section             TEXT,
      academic_year_id    INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      homeroom_teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      room                TEXT,
      capacity            INTEGER NOT NULL DEFAULT 50,
      is_active           INTEGER NOT NULL DEFAULT 1,
      UNIQUE (name, academic_year_id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      code           TEXT NOT NULL UNIQUE,
      last_name_kh   TEXT NOT NULL,
      first_name_kh  TEXT NOT NULL,
      last_name_en   TEXT,
      first_name_en  TEXT,
      gender         TEXT NOT NULL CHECK (gender IN ('M','F')),
      dob            TEXT,
      class_id       INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      phone          TEXT,
      guardian_name  TEXT,
      guardian_phone TEXT,
      address        TEXT,
      enroll_date    TEXT,
      status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','graduated','transferred')),
      note           TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS class_subjects (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (class_id, subject_id)
    );

    CREATE TABLE IF NOT EXISTS score_types (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      code    TEXT NOT NULL UNIQUE,
      name_kh TEXT NOT NULL,
      name_en TEXT NOT NULL,
      weight  REAL NOT NULL DEFAULT 10,
      sort    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scores (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject_id    INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      term_id       INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
      score_type_id INTEGER NOT NULL REFERENCES score_types(id) ON DELETE CASCADE,
      score         REAL NOT NULL,
      entered_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (student_id, subject_id, term_id, score_type_id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      date        TEXT NOT NULL,
      status      TEXT NOT NULL CHECK (status IN ('present','absent','late','permission')),
      note        TEXT,
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (student_id, date)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      user_name  TEXT,
      action     TEXT NOT NULL,
      entity     TEXT,
      entity_id  INTEGER,
      detail     TEXT,
      ip         TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
      ON users(lower(email)) WHERE email IS NOT NULL AND email <> '';
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
    CREATE INDEX IF NOT EXISTS idx_scores_lookup ON scores(term_id, subject_id, student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date, class_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);
  ensureColumn("users", "google_sub", "TEXT");
  ensureColumn("users", "avatar_url", "TEXT");
  ensureColumn("users", "auth_provider", "TEXT NOT NULL DEFAULT 'password'");
  seedSettings();
  seedScoreTypes();
}

/** Lightweight migration helper for columns added after the first release. */
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

const DEFAULT_SETTINGS: Record<string, string> = {
  school_name: "",
  school_name_en: "",
  school_address: "",
  school_phone: "",
  school_email: "",
  director_name: "",
  motto: "",
  pass_mark: "50",
  max_score: "100",
  grade_scale: JSON.stringify([
    { grade: "A", min: 90, remark: "ល្អប្រសើរ" },
    { grade: "B", min: 80, remark: "ល្អ" },
    { grade: "C", min: 70, remark: "មធ្យមល្អ" },
    { grade: "D", min: 60, remark: "មធ្យម" },
    { grade: "E", min: 50, remark: "ខ្សោយ" },
    { grade: "F", min: 0, remark: "ធ្លាក់" },
  ]),
  locale: "km-KH",
  attendance_absent_limit: "20",
  allow_registration: "1",
};

/** Default assessment types — system configuration (not demo data). */
const DEFAULT_SCORE_TYPES = [
  { code: "quiz", name_kh: "ការងារផ្ទះ/តេស្តខ្លី", name_en: "Assignment", weight: 10, sort: 1 },
  { code: "monthly", name_kh: "ពិន្ទុប្រចាំខែ", name_en: "Monthly Test", weight: 20, sort: 2 },
  { code: "midterm", name_kh: "ពិន្ទុពាក់កណ្ដាលឆមាស", name_en: "Midterm", weight: 30, sort: 3 },
  { code: "final", name_kh: "ពិន្ទុបញ្ចប់ឆមាស", name_en: "Final Exam", weight: 40, sort: 4 },
];

function seedSettings() {
  const stmt = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) stmt.run(k, v);
}

function seedScoreTypes() {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO score_types (code, name_kh, name_en, weight, sort) VALUES (?,?,?,?,?)`,
  );
  for (const t of DEFAULT_SCORE_TYPES) stmt.run(t.code, t.name_kh, t.name_en, t.weight, t.sort);
}

export function getSettings(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function audit(
  user: { id?: number; name?: string } | null | undefined,
  action: string,
  entity: string,
  entityId: number | null,
  detail: string,
  ip?: string,
) {
  db.prepare(
    "INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, detail, ip) VALUES (?,?,?,?,?,?,?)",
  ).run(
    user?.id ?? null,
    user?.name ?? "ប្រព័ន្ធ",
    action,
    entity,
    entityId ?? null,
    detail,
    ip ?? null,
  );
}
