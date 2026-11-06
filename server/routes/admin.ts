import { Router } from "express";
import { db, audit, getSettings, setSetting } from "../db.js";
import { adminOnly, authRequired, hashPassword } from "../auth.js";
import { HttpError, asyncHandler, pageParams } from "../util.js";
import { getGradeScale, getScoreTypes } from "../compute.js";

const router = Router();
router.use(authRequired);

/* ---------------------------------- users --------------------------------- */

router.post(
  "/users",
  adminOnly,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    if (!b.username || !b.name || !b.password) throw new HttpError(400, "សូមបញ្ចូលឈ្មោះ ឈ្មោះអ្នកប្រើ និងលេខសម្ងាត់");
    if (String(b.password).length < 6) throw new HttpError(400, "លេខសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ");
    try {
      const info = db
        .prepare(
          `INSERT INTO users (username, password_hash, name, name_en, role, email, phone, gender, subject_id, hire_date, is_active)
           VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
        )
        .run(
          String(b.username).trim().toLowerCase(),
          hashPassword(String(b.password)),
          b.name,
          b.name_en ?? null,
          b.role === "admin" ? "admin" : "teacher",
          b.email ?? null,
          b.phone ?? null,
          b.gender ?? null,
          b.subject_id ? Number(b.subject_id) : null,
          b.hire_date ?? null,
        );
      audit(req.user, "create", "user", Number(info.lastInsertRowid), `បង្កើតគណនី ${b.name}`, req.ip);
      res.status(201).json({ id: Number(info.lastInsertRowid) });
    } catch (e: any) {
      if (String(e.message).includes("UNIQUE")) throw new HttpError(409, "ឈ្មោះអ្នកប្រើនេះមានរួចហើយ");
      throw e;
    }
  }),
);

router.put(
  "/users/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    if (!user) throw new HttpError(404, "រកមិនឃើញគណនី");
    db.prepare(
      `UPDATE users SET name=COALESCE(?,name), name_en=?, role=COALESCE(?,role), email=?, phone=?,
         gender=?, subject_id=?, hire_date=?, is_active=COALESCE(?,is_active) WHERE id=?`,
    ).run(
      b.name ?? null,
      b.name_en ?? null,
      b.role ?? null,
      b.email ?? null,
      b.phone ?? null,
      b.gender ?? null,
      b.subject_id ? Number(b.subject_id) : null,
      b.hire_date ?? null,
      b.is_active === undefined ? null : b.is_active ? 1 : 0,
      id,
    );
    if (b.password) {
      if (String(b.password).length < 6) throw new HttpError(400, "លេខសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ");
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(String(b.password)), id);
    }
    audit(req.user, "update", "user", id, `កែប្រែគណនី ${b.name ?? user.name}`, req.ip);
    res.json({ ok: true });
  }),
);

router.delete(
  "/users/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) throw new HttpError(400, "អ្នកមិនអាចលុបគណនីខ្លួនឯងបានទេ");
    const admins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND is_active=1").get() as any;
    const target = db.prepare("SELECT role FROM users WHERE id = ?").get(id) as any;
    if (!target) throw new HttpError(404, "រកមិនឃើញគណនី");
    if (target.role === "admin" && admins.c <= 1) throw new HttpError(400, "ត្រូវមានអ្នកគ្រប់គ្រងយ៉ាងតិច ១ នាក់");
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    audit(req.user, "delete", "user", id, "លុបគណនី", req.ip);
    res.json({ ok: true });
  }),
);

/* -------------------------------- settings -------------------------------- */

router.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const settings = getSettings();
    res.json({
      settings,
      gradeScale: getGradeScale(),
      scoreTypes: getScoreTypes(),
      years: db.prepare("SELECT * FROM academic_years ORDER BY name DESC").all(),
      terms: db
        .prepare(
          `SELECT t.*, y.name AS year_name FROM terms t JOIN academic_years y ON y.id=t.academic_year_id
            ORDER BY y.name DESC, t.semester`,
        )
        .all(),
    });
  }),
);

router.put(
  "/settings",
  adminOnly,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const simpleKeys = [
      "school_name",
      "school_name_en",
      "school_address",
      "school_phone",
      "school_email",
      "director_name",
      "motto",
      "pass_mark",
      "max_score",
      "attendance_absent_limit",
      "locale",
    ];
    for (const key of simpleKeys) {
      if (b[key] !== undefined) setSetting(key, String(b[key]));
    }
    if (Array.isArray(b.grade_scale)) {
      const scale = b.grade_scale
        .map((g: any) => ({ grade: String(g.grade), min: Number(g.min), remark: String(g.remark ?? "") }))
        .sort((a: any, z: any) => z.min - a.min);
      setSetting("grade_scale", JSON.stringify(scale));
    }
    if (Array.isArray(b.scoreTypes)) {
      const stmt = db.prepare("UPDATE score_types SET weight = ? WHERE id = ?");
      for (const t of b.scoreTypes) if (t?.id) stmt.run(Number(t.weight), Number(t.id));
    }
    audit(req.user, "update", "settings", null, "កែប្រែការកំណត់ប្រព័ន្ធ", req.ip);
    res.json({ ok: true, settings: getSettings(), gradeScale: getGradeScale(), scoreTypes: getScoreTypes() });
  }),
);

/* ----------------------------- academic years ----------------------------- */

router.post(
  "/years",
  adminOnly,
  asyncHandler(async (req, res) => {
    const { name, start_date, end_date } = req.body ?? {};
    if (!name) throw new HttpError(400, "សូមបញ្ចូលឈ្មោះឆ្នាំសិក្សា");
    try {
      const info = db
        .prepare("INSERT INTO academic_years (name, start_date, end_date) VALUES (?,?,?)")
        .run(String(name).trim(), start_date ?? null, end_date ?? null);
      const yearId = Number(info.lastInsertRowid);
      db.prepare(
        "INSERT INTO terms (academic_year_id, name, semester, start_date, end_date) VALUES (?,?,?,?,?)",
      ).run(yearId, "ឆមាសទី១", 1, start_date ?? null, null);
      db.prepare(
        "INSERT INTO terms (academic_year_id, name, semester, start_date, end_date) VALUES (?,?,?,?,?)",
      ).run(yearId, "ឆមាសទី២", 2, null, end_date ?? null);
      audit(req.user, "create", "academic_year", yearId, `បង្កើតឆ្នាំសិក្សា ${name}`, req.ip);
      res.status(201).json({ id: yearId });
    } catch (e: any) {
      if (String(e.message).includes("UNIQUE")) throw new HttpError(409, "ឆ្នាំសិក្សានេះមានរួចហើយ");
      throw e;
    }
  }),
);

router.put(
  "/years/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, start_date, end_date, is_current } = req.body ?? {};
    db.prepare(
      "UPDATE academic_years SET name=COALESCE(?,name), start_date=?, end_date=?, is_current=COALESCE(?,is_current) WHERE id=?",
    ).run(name ?? null, start_date ?? null, end_date ?? null, is_current === undefined ? null : is_current ? 1 : 0, id);
    if (is_current) db.prepare("UPDATE academic_years SET is_current = 0 WHERE id <> ?").run(id);
    audit(req.user, "update", "academic_year", id, "កែប្រែឆ្នាំសិក្សា", req.ip);
    res.json({ ok: true });
  }),
);

router.put(
  "/terms/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, start_date, end_date, is_current } = req.body ?? {};
    db.prepare(
      "UPDATE terms SET name=COALESCE(?,name), start_date=?, end_date=?, is_current=COALESCE(?,is_current) WHERE id=?",
    ).run(name ?? null, start_date ?? null, end_date ?? null, is_current === undefined ? null : is_current ? 1 : 0, id);
    if (is_current) db.prepare("UPDATE terms SET is_current = 0 WHERE id <> ?").run(id);
    audit(req.user, "update", "term", id, "កែប្រែឆមាសសិក្សា", req.ip);
    res.json({ ok: true });
  }),
);

/* ------------------------------- score types ------------------------------ */

router.get(
  "/score-types",
  asyncHandler(async (_req, res) => {
    res.json({ data: getScoreTypes() });
  }),
);

router.put(
  "/score-types/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name_kh, weight } = req.body ?? {};
    db.prepare("UPDATE score_types SET name_kh = COALESCE(?, name_kh), weight = COALESCE(?, weight) WHERE id = ?").run(
      name_kh ?? null,
      weight === undefined ? null : Number(weight),
      id,
    );
    audit(req.user, "update", "score_type", id, "កែប្រែប្រភេទពិន្ទុ", req.ip);
    res.json({ ok: true });
  }),
);

/* --------------------------------- audit ---------------------------------- */

router.get(
  "/audit",
  adminOnly,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pageParams(req, 30);
    const where: string[] = [];
    const params: any[] = [];
    if (req.query.action) {
      where.push("action = ?");
      params.push(String(req.query.action));
    }
    if (req.query.search) {
      where.push("(user_name LIKE ? OR detail LIKE ? OR entity LIKE ?)");
      const like = `%${req.query.search}%`;
      params.push(like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM audit_logs ${whereSql}`).get(...params) as any).c;
    const data = db
      .prepare(`SELECT * FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);
    res.json({ data, total, page, limit });
  }),
);

export default router;
