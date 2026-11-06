import { Router } from "express";
import { db, audit, getSettings } from "../db.js";
import { adminOnly, authRequired } from "../auth.js";
import { HttpError, asyncHandler } from "../util.js";
import { currentTermId, getGradeScale, getScoreTypes } from "../compute.js";

const router = Router();
router.use(authRequired);

/* ---------------------------------- meta --------------------------------- */

router.get(
  "/meta",
  asyncHandler(async (req, res) => {
    const teacherId = req.query.teacher_id ? Number(req.query.teacher_id) : null;
    const years = db.prepare("SELECT * FROM academic_years ORDER BY name DESC").all();
    const terms = db.prepare("SELECT * FROM terms ORDER BY academic_year_id DESC, semester").all();
    const classes = db
      .prepare(
        `SELECT c.*, u.name AS homeroom_name,
                (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status='active') AS student_count
           FROM classes c LEFT JOIN users u ON u.id = c.homeroom_teacher_id
          ORDER BY c.grade_level, c.name`,
      )
      .all();
    const subjects = db.prepare("SELECT * FROM subjects ORDER BY name_kh").all();
    const teachers = db
      .prepare(
        `SELECT u.id, u.name, u.name_en, u.role, u.is_active, u.subject_id
           FROM users u WHERE u.is_active = 1 ORDER BY u.name`,
      )
      .all();
    const assignments = db
      .prepare(
        `SELECT cs.id, cs.class_id, cs.subject_id, cs.teacher_id, t.name AS teacher_name
           FROM class_subjects cs LEFT JOIN users t ON t.id = cs.teacher_id`,
      )
      .all();
    const scoreTypes = getScoreTypes();
    const settings = getSettings();
    const currentTerm = db.prepare("SELECT * FROM terms WHERE is_current = 1").get() ??
      (currentTermId()
        ? db.prepare("SELECT * FROM terms WHERE id = ?").get(currentTermId())
        : undefined);
    const currentYear =
      (currentTerm as { academic_year_id?: number } | undefined)?.academic_year_id
        ? db
            .prepare("SELECT * FROM academic_years WHERE id = ?")
            .get((currentTerm as { academic_year_id: number }).academic_year_id)
        : db.prepare("SELECT * FROM academic_years WHERE is_current = 1").get() ??
          db.prepare("SELECT * FROM academic_years ORDER BY name DESC LIMIT 1").get();

    res.json({
      years,
      terms,
      classes,
      subjects,
      teachers: teacherId ? teachers.filter((t: any) => t.id === teacherId) : teachers,
      assignments,
      scoreTypes,
      gradeScale: getGradeScale(),
      settings: {
        school_name: settings.school_name,
        school_name_en: settings.school_name_en,
        school_address: settings.school_address,
        school_phone: settings.school_phone,
        school_email: settings.school_email,
        director_name: settings.director_name,
        motto: settings.motto,
        pass_mark: Number(settings.pass_mark),
        max_score: Number(settings.max_score),
        attendance_absent_limit: Number(settings.attendance_absent_limit),
        locale: settings.locale,
        academic_year_id: (currentYear as any)?.id ?? null,
        term_id: (currentTerm as any)?.id ?? null,
      },
    });
  }),
);

/* ------------------------------- class CRUD ------------------------------- */

router.get(
  "/classes",
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, u.name AS homeroom_name,
                (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status='active') AS student_count,
                (SELECT COUNT(*) FROM class_subjects cs WHERE cs.class_id = c.id) AS subject_count,
                y.name AS year_name
           FROM classes c
           LEFT JOIN users u ON u.id = c.homeroom_teacher_id
           LEFT JOIN academic_years y ON y.id = c.academic_year_id
          ORDER BY c.grade_level, c.name`,
      )
      .all();
    res.json({ data: rows });
  }),
);

router.post(
  "/classes",
  adminOnly,
  asyncHandler(async (req, res) => {
    const { name, grade_level, section, academic_year_id, homeroom_teacher_id, room, capacity } = req.body ?? {};
    if (!name || !grade_level || !academic_year_id) throw new HttpError(400, "សូមបញ្ចូលឈ្មោះថ្នាក់ កម្រិត និងឆ្នាំសិក្សា");
    try {
      const info = db
        .prepare(
          `INSERT INTO classes (name, grade_level, section, academic_year_id, homeroom_teacher_id, room, capacity)
           VALUES (?,?,?,?,?,?,?)`,
        )
        .run(
          String(name).trim(),
          Number(grade_level),
          section || null,
          Number(academic_year_id),
          homeroom_teacher_id ? Number(homeroom_teacher_id) : null,
          room || null,
          Number(capacity) || 50,
        );
      audit(req.user, "create", "class", Number(info.lastInsertRowid), `បង្កើតថ្នាក់ ${name}`, req.ip);
      res.status(201).json({ id: Number(info.lastInsertRowid) });
    } catch (e: any) {
      if (String(e.message).includes("UNIQUE")) throw new HttpError(409, "ឈ្មោះថ្នាក់នេះមានរួចហើយក្នុងឆ្នាំសិក្សានេះ");
      throw e;
    }
  }),
);

router.put(
  "/classes/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, grade_level, section, academic_year_id, homeroom_teacher_id, room, capacity, is_active } =
      req.body ?? {};
    db.prepare(
      `UPDATE classes SET name=?,
         grade_level=COALESCE(?, grade_level),
         section=?, academic_year_id=COALESCE(?, academic_year_id),
         homeroom_teacher_id=?, room=?, capacity=COALESCE(?, capacity), is_active=COALESCE(?, is_active)
       WHERE id=?`,
    ).run(
      name ?? null,
      grade_level ? Number(grade_level) : null,
      section ?? null,
      academic_year_id ? Number(academic_year_id) : null,
      homeroom_teacher_id ? Number(homeroom_teacher_id) : null,
      room ?? null,
      capacity ? Number(capacity) : null,
      is_active === undefined ? null : is_active ? 1 : 0,
      id,
    );
    audit(req.user, "update", "class", id, `កែប្រែថ្នាក់ ${name ?? ""}`, req.ip);
    res.json({ ok: true });
  }),
);

router.delete(
  "/classes/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const count = db.prepare("SELECT COUNT(*) AS c FROM students WHERE class_id = ?").get(id) as {
      c: number;
    };
    if (count.c > 0) throw new HttpError(400, "មិនអាចលុបថ្នាក់ដែលនៅមានសិស្សបានទេ");
    db.prepare("DELETE FROM classes WHERE id = ?").run(id);
    audit(req.user, "delete", "class", id, "លុបថ្នាក់", req.ip);
    res.json({ ok: true });
  }),
);

/* ------------------------------ class subjects ---------------------------- */

router.get(
  "/classes/:id/subjects",
  asyncHandler(async (req, res) => {
    const classId = Number(req.params.id);
    const rows = db
      .prepare(
        `SELECT s.*, t.id AS teacher_id, t.name AS teacher_name, cs.id AS assignment_id
           FROM class_subjects cs
           JOIN subjects s ON s.id = cs.subject_id
           LEFT JOIN users t ON t.id = cs.teacher_id
          WHERE cs.class_id = ? ORDER BY s.name_kh`,
      )
      .all(classId);
    res.json({ data: rows });
  }),
);

router.post(
  "/classes/:id/subjects",
  adminOnly,
  asyncHandler(async (req, res) => {
    const classId = Number(req.params.id);
    const { subject_id, teacher_id } = req.body ?? {};
    if (!subject_id) throw new HttpError(400, "សូមជ្រើសរើសមុខវិជ្ជា");
    try {
      db.prepare("INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES (?,?,?)").run(
        classId,
        Number(subject_id),
        teacher_id ? Number(teacher_id) : null,
      );
    } catch (e: any) {
      if (String(e.message).includes("UNIQUE")) throw new HttpError(409, "មុខវិជ្ជានេះមានក្នុងថ្នាក់រួចហើយ");
      throw e;
    }
    audit(req.user, "create", "class_subject", classId, "បន្ថែមមុខវិជ្ជាចូលថ្នាក់", req.ip);
    res.status(201).json({ ok: true });
  }),
);

router.put(
  "/class-subjects/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const teacherId = req.body?.teacher_id ? Number(req.body.teacher_id) : null;
    db.prepare("UPDATE class_subjects SET teacher_id = ? WHERE id = ?").run(teacherId, id);
    audit(req.user, "update", "class_subject", id, "ផ្លាស់ប្ដូរគ្រូបង្រៀន", req.ip);
    res.json({ ok: true });
  }),
);

router.delete(
  "/class-subjects/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    db.prepare("DELETE FROM class_subjects WHERE id = ?").run(id);
    audit(req.user, "delete", "class_subject", id, "ដកមុខវិជ្ជាចេញពីថ្នាក់", req.ip);
    res.json({ ok: true });
  }),
);

/* -------------------------------- subjects -------------------------------- */

router.get(
  "/subjects",
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare(
        `SELECT s.*,
                (SELECT COUNT(*) FROM class_subjects cs WHERE cs.subject_id = s.id) AS class_count,
                (SELECT COUNT(*) FROM scores sc WHERE sc.subject_id = s.id) AS score_count
           FROM subjects s ORDER BY s.name_kh`,
      )
      .all();
    res.json({ data: rows });
  }),
);

router.post(
  "/subjects",
  adminOnly,
  asyncHandler(async (req, res) => {
    const { code, name_kh, name_en, credits, color } = req.body ?? {};
    if (!code || !name_kh) throw new HttpError(400, "សូមបញ្ចូលកូដ និងឈ្មោះមុខវិជ្ជា");
    try {
      const info = db
        .prepare("INSERT INTO subjects (code, name_kh, name_en, credits, color) VALUES (?,?,?,?,?)")
        .run(
          String(code).toUpperCase().trim(),
          name_kh,
          name_en || name_kh,
          Number(credits) || 1,
          color || "#4f46e5",
        );
      audit(req.user, "create", "subject", Number(info.lastInsertRowid), `បង្កើតមុខវិជ្ជា ${name_kh}`, req.ip);
      res.status(201).json({ id: Number(info.lastInsertRowid) });
    } catch (e: any) {
      if (String(e.message).includes("UNIQUE")) throw new HttpError(409, "កូដមុខវិជ្ជានេះមានរួចហើយ");
      throw e;
    }
  }),
);

router.put(
  "/subjects/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { code, name_kh, name_en, credits, color, is_active } = req.body ?? {};
    db.prepare(
      `UPDATE subjects SET code=COALESCE(?, code), name_kh=COALESCE(?, name_kh), name_en=COALESCE(?, name_en),
         credits=COALESCE(?, credits), color=COALESCE(?, color), is_active=COALESCE(?, is_active) WHERE id=?`,
    ).run(
      code ? String(code).toUpperCase().trim() : null,
      name_kh ?? null,
      name_en ?? null,
      credits === undefined ? null : Number(credits),
      color ?? null,
      is_active === undefined ? null : is_active ? 1 : 0,
      id,
    );
    audit(req.user, "update", "subject", id, `កែប្រែមុខវិជ្ជា ${name_kh ?? ""}`, req.ip);
    res.json({ ok: true });
  }),
);

router.delete(
  "/subjects/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const used = db.prepare("SELECT COUNT(*) AS c FROM scores WHERE subject_id = ?").get(id) as { c: number };
    if (used.c > 0) throw new HttpError(400, "មិនអាចលុបមុខវិជ្ជាដែលមានពិន្ទុរួចហើយបានទេ");
    db.prepare("DELETE FROM subjects WHERE id = ?").run(id);
    audit(req.user, "delete", "subject", id, "លុបមុខវិជ្ជា", req.ip);
    res.json({ ok: true });
  }),
);

export default router;
