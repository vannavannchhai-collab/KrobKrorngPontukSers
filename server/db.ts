import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");
export const DATA_DIR = path.join(ROOT, "data");
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch {
  /* read-only filesystem (Vercel) — only reachable when using a remote database */
}

/**
 * Storage driver
 * --------------------------------------------------------------
 * • Local / any server with a disk : SQLite file through `node:sqlite`.
 * • Vercel (serverless, read-only FS): libSQL / Turso through `@libsql/client`.
 *
 * Set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) to use the remote driver.
 * Every query is exposed asynchronously so both drivers share one code path.
 */
const REMOTE_URL = (process.env.TURSO_DATABASE_URL ?? "").trim();
const REMOTE_TOKEN = (process.env.TURSO_AUTH_TOKEN ?? "").trim();
export const isRemoteDb = /^(libsql|https?):\/\//.test(REMOTE_URL);

export const DB_PATH =
  process.env.DB_PATH ?? path.join(DATA_DIR, "school.db");

/** Persistent JWT secret so sessions survive restarts. */
export const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (isRemoteDb) {
    console.warn(
      "⚠️  JWT_SECRET មិនទាន់កំណត់ — កំពុងប្រើតម្លៃក្លែងក្លាយពី database credentials។ សូមកំណត់ JWT_SECRET នៅ environment variables។",
    );
    return crypto
      .createHash("sha256")
      .update(`kps-jwt:${REMOTE_URL}:${REMOTE_TOKEN}`)
      .digest("hex");
  }
  const secretFile = path.join(DATA_DIR, ".jwt-secret");
  try {
    if (fs.existsSync(secretFile)) return fs.readFileSync(secretFile, "utf8").trim();
    const secret = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
    return secret;
  } catch {
    const secret = crypto.randomBytes(48).toString("hex");
    console.warn("⚠️  មិនអាចសរសេរ data/.jwt-secret បានទេ — សូមកំណត់ JWT_SECRET");
    return secret;
  }
})();

export interface ExecResult {
  changes: number;
  lastInsertRowid: number;
}

type Primitive = string | number | bigint | boolean | null | undefined | Uint8Array;

function normalizeArgs(args: Primitive[]): (string | number | bigint | null | Uint8Array)[] {
  return args.map((v) => {
    if (v === undefined) return null;
    if (typeof v === "boolean") return v ? 1 : 0;
    return v as string | number | bigint | null | Uint8Array;
  });
}

interface Driver {
  all(sql: string, args: Primitive[]): Promise<Record<string, unknown>[]>;
  run(sql: string, args: Primitive[]): Promise<ExecResult>;
  exec(sql: string): Promise<void>;
}

class LocalDriver implements Driver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly sync: any) {}

  async all(sql: string, args: Primitive[]) {
    return this.sync.prepare(sql).all(...normalizeArgs(args)) as Record<string, unknown>[];
  }

  async run(sql: string, args: Primitive[]) {
    const res = this.sync.prepare(sql).run(...normalizeArgs(args));
    return {
      changes: Number(res?.changes ?? 0),
      lastInsertRowid: Number(res?.lastInsertRowid ?? 0),
    };
  }

  async exec(sql: string) {
    this.sync.exec(sql);
  }
}

class RemoteDriver implements Driver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly client: any) {}

  async all(sql: string, args: Primitive[]) {
    const res = await this.client.execute({ sql, args: normalizeArgs(args) });
    return (res.rows ?? []) as Record<string, unknown>[];
  }

  async run(sql: string, args: Primitive[]) {
    const res = await this.client.execute({ sql, args: normalizeArgs(args) });
    return {
      changes: Number(res.rowsAffected ?? 0),
      lastInsertRowid: Number(res.lastInsertRowid ?? 0),
    };
  }

  async exec(sql: string) {
    await this.client.executeMultiple(sql);
  }
}

let driverPromise: Promise<Driver> | null = null;

function getDriver(): Promise<Driver> {
  if (!driverPromise) {
    driverPromise = (async () => {
      if (isRemoteDb) {
        const { createClient } = await import("@libsql/client/web");
        const url = REMOTE_URL.replace(/^libsql:\/\//, "https://");
        const client = createClient({
          url,
          authToken: REMOTE_TOKEN || undefined,
        });
        return new RemoteDriver(client);
      }
      // The specifier is assembled at runtime so bundlers (Vercel/esbuild) do
      // not try to resolve the Node-only SQLite module when deploying.
      const sqliteModule = ["node", "sqlite"].join(":");
      const { DatabaseSync } = (await import(sqliteModule)) as {
        DatabaseSync: new (path: string) => unknown;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sync: any = new (DatabaseSync as any)(DB_PATH);
      try {
        sync.exec("PRAGMA journal_mode = WAL;");
        sync.exec("PRAGMA foreign_keys = ON;");
      } catch {
        /* some drivers do not support these pragmas */
      }
      return new LocalDriver(sync);
    })();
  }
  return driverPromise;
}

/** Statement handle — chainable and awaitable, identical on both drivers. */
export class Statement {
  constructor(private readonly sql: string) {}

  async get<T = Record<string, unknown>>(...args: Primitive[]): Promise<T | undefined> {
    const rows = await (await getDriver()).all(this.sql, args);
    return rows[0] as T | undefined;
  }

  async all<T = Record<string, unknown>>(...args: Primitive[]): Promise<T[]> {
    return (await (await getDriver()).all(this.sql, args)) as T[];
  }

  async run(...args: Primitive[]): Promise<ExecResult> {
    return (await getDriver()).run(this.sql, args);
  }
}

export const db = {
  prepare(sql: string): Statement {
    return new Statement(sql);
  },
  async exec(sql: string): Promise<ExecResult> {
    await (await getDriver()).exec(sql);
    return { changes: 0, lastInsertRowid: 0 };
  },
  /** Run several statements atomically (used for bulk imports). */
  async batch(statements: { sql: string; args?: Primitive[] }[]): Promise<void> {
    const driver = await getDriver();
    for (const s of statements) await driver.run(s.sql, s.args ?? []);
  },
};

export async function initSchema() {
  await db.exec(`
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

  await ensureColumn("users", "google_sub", "TEXT");
  await ensureColumn("users", "avatar_url", "TEXT");
  await ensureColumn("users", "auth_provider", "TEXT NOT NULL DEFAULT 'password'");
  await seedSettings();
  await seedScoreTypes();
}

/** Lightweight migration helper for columns added after the first release. */
async function ensureColumn(table: string, column: string, ddl: string) {
  const cols = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if (!cols.some((c) => c.name === column)) {
    try {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    } catch {
      /* concurrent cold starts may race here — the column then already exists */
    }
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
};

/** Default assessment types — system configuration (not demo data). */
const DEFAULT_SCORE_TYPES = [
  { code: "quiz", name_kh: "ការងារផ្ទះ/តេស្តខ្លី", name_en: "Assignment", weight: 10, sort: 1 },
  { code: "monthly", name_kh: "ពិន្ទុប្រចាំខែ", name_en: "Monthly Test", weight: 20, sort: 2 },
  { code: "midterm", name_kh: "ពិន្ទុពាក់កណ្ដាលឆមាស", name_en: "Midterm", weight: 30, sort: 3 },
  { code: "final", name_kh: "ពិន្ទុបញ្ចប់ឆមាស", name_en: "Final Exam", weight: 40, sort: 4 },
];

async function seedSettings() {
  const stmt = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) await stmt.run(k, v);
}

async function seedScoreTypes() {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO score_types (code, name_kh, name_en, weight, sort) VALUES (?,?,?,?,?)`,
  );
  for (const t of DEFAULT_SCORE_TYPES) await stmt.run(t.code, t.name_kh, t.name_en, t.weight, t.sort);
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.prepare("SELECT key, value FROM settings").all<{
    key: string;
    value: string;
  }>();
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(key: string, value: string) {
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

export async function audit(
  user: { id?: number; name?: string } | null | undefined,
  action: string,
  entity: string,
  entityId: number | null,
  detail: string,
  ip?: string,
) {
  await db
    .prepare(
      "INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, detail, ip) VALUES (?,?,?,?,?,?,?)",
    )
    .run(
      user?.id ?? null,
      user?.name ?? "ប្រព័ន្ធ",
      action,
      entity,
      entityId ?? null,
      detail,
      ip ?? null,
    );
}
