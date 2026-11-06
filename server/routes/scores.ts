import { Router } from "express";
import { db, audit, getSettings } from "../db.js";
import { authRequired, canEditClass, canEditSubject } from "../auth.js";
import { HttpError, asyncHandler } from "../util.js";
import { currentTermId, getScoreTypes } from "../compute.js";

const router = Router();
router.use(authRequired);

/** Score entry grid for one class + subject + term. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const classId = Number(req.query.class_id);
    const subjectId = Number(req.query.subject_id);
    const termId = Number(req.query.term_id) || currentTermId();
    if (!classId || !subjectId || !termId) throw new HttpError(400, "សូមជ្រើសរើសថ្នាក់ មុខវិជ្ជា និងឆមាស");

    const students = db
      .prepare(
        `SELECT id, code, last_name_kh, first_name_kh, gender,
                (last_name_kh || ' ' || first_name_kh) AS name_kh
           FROM students WHERE class_id = ? AND status = 'active'
          ORDER BY last_name_kh, first_name_kh`,
      )
      .all(classId) as any[];

    const scoreTypes = getScoreTypes();
    const rows = db
      .prepare(
        `SELECT sc.student_id, st.code AS type_code, sc.score, sc.updated_at
           FROM scores sc JOIN score_types st ON st.id = sc.score_type_id
           JOIN students s ON s.id = sc.student_id
          WHERE s.class_id = ? AND sc.subject_id = ? AND sc.term_id = ?`,
      )
      .all(classId, subjectId, termId) as any[];

    const scores: Record<string, number> = {};
    const updatedAt = new Map<string, string>();
    for (const r of rows) {
      scores[`${r.student_id}|${r.type_code}`] = r.score;
      updatedAt.set(`${r.student_id}|${r.type_code}`, r.updated_at);
    }

    const subject = db.prepare("SELECT * FROM subjects WHERE id = ?").get(subjectId) as any;
    const cls = db.prepare("SELECT * FROM classes WHERE id = ?").get(classId) as any;
    const term = db.prepare("SELECT * FROM terms WHERE id = ?").get(termId) as any;
    const assignment = db
      .prepare(
        `SELECT t.name AS teacher_name FROM class_subjects cs
           LEFT JOIN users t ON t.id = cs.teacher_id WHERE cs.class_id = ? AND cs.subject_id = ?`,
      )
      .get(classId, subjectId) as any;

    const canEdit = req.user!.role === "admin" || canEditSubject(classId, subjectId, req.user!);
    const lastUpdate = rows.reduce<string | null>(
      (acc, r) => (!acc || r.updated_at > acc ? r.updated_at : acc),
      null,
    );

    res.json({
      students,
      scoreTypes,
      scores,
      canEdit,
      subject,
      class: cls,
      term,
      teacherName: assignment?.teacher_name ?? null,
      lastUpdate,
      maxScore: Number(getSettings().max_score ?? 100),
    });
  }),
);

/** Save a batch of scores (values of null delete an existing score). */
router.put(
  "/bulk",
  asyncHandler(async (req, res) => {
    const { class_id, subject_id, term_id, entries } = req.body ?? {};
    const classId = Number(class_id);
    const subjectId = Number(subject_id);
    const termId = Number(term_id);
    if (!classId || !subjectId || !termId) throw new HttpError(400, "ព័ត៌មានមិនគ្រប់គ្រាន់");
    if (!canEditSubject(classId, subjectId, req.user!)) {
      throw new HttpError(403, "អ្នកគ្មានសិទ្ធិបញ្ចូលពិន្ទុមុខវិជ្ជានេះទេ");
    }
    if (!Array.isArray(entries) || entries.length === 0) throw new HttpError(400, "គ្មានពិន្ទុត្រូវរក្សាទុក");
    const maxScore = Number(getSettings().max_score ?? 100);

    const scoreTypeIds = new Set(
      (db.prepare("SELECT id FROM score_types").all() as any[]).map((r) => r.id),
    );
    const studentIds = new Set(
      (db.prepare("SELECT id FROM students WHERE class_id = ?").all(classId) as any[]).map((r) => r.id),
    );

    const upsert = db.prepare(
      `INSERT INTO scores (student_id, subject_id, term_id, score_type_id, score, entered_by, updated_at)
       VALUES (?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(student_id, subject_id, term_id, score_type_id)
       DO UPDATE SET score = excluded.score, entered_by = excluded.entered_by, updated_at = datetime('now')`,
    );
    const remove = db.prepare(
      "DELETE FROM scores WHERE student_id = ? AND subject_id = ? AND term_id = ? AND score_type_id = ?",
    );

    let saved = 0;
    db.exec("BEGIN");
    try {
      for (const e of entries) {
        const studentId = Number(e.student_id);
        const typeId = Number(e.score_type_id);
        if (!studentIds.has(studentId)) throw new HttpError(400, "សិស្សមិនស្ថិតក្នុងថ្នាក់នេះ");
        if (!scoreTypeIds.has(typeId)) throw new HttpError(400, "ប្រភេទពិន្ទុមិនត្រឹមត្រូវ");
        if (e.score === null || e.score === "" || e.score === undefined) {
          remove.run(studentId, subjectId, termId, typeId);
          continue;
        }
        const value = Number(e.score);
        if (Number.isNaN(value) || value < 0 || value > maxScore) {
          throw new HttpError(400, `ពិន្ទុត្រូវនៅចន្លោះ 0 ដល់ ${maxScore}`);
        }
        upsert.run(studentId, subjectId, termId, typeId, value, req.user!.id);
        saved++;
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    const cls = db.prepare("SELECT name FROM classes WHERE id = ?").get(classId) as any;
    const sub = db.prepare("SELECT name_kh FROM subjects WHERE id = ?").get(subjectId) as any;
    audit(
      req.user,
      "update",
      "score",
      subjectId,
      `រក្សាទុកពិន្ទុ ${saved} កំណត់ — ${cls?.name ?? ""} / ${sub?.name_kh ?? ""}`,
      req.ip,
    );
    res.json({ ok: true, saved });
  }),
);

/** A single student's score history in one subject (for teacher drill-down). */
router.get(
  "/student/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const rows = db
      .prepare(
        `SELECT sc.*, st.code AS type_code, st.name_kh AS type_name, st.weight,
                s.name_kh AS subject_name, t.name AS term_name, t.id AS term_id
           FROM scores sc
           JOIN score_types st ON st.id = sc.score_type_id
           JOIN subjects s ON s.id = sc.subject_id
           JOIN terms t ON t.id = sc.term_id
          WHERE sc.student_id = ? ORDER BY t.academic_year_id, t.semester, s.name_kh`,
      )
      .all(id);
    res.json({ data: rows });
  }),
);

/** Everything the current teacher is allowed to grade, used by the entry page. */
router.get(
  "/my-assignments",
  asyncHandler(async (req, res) => {
    if (req.user!.role === "admin") {
      const rows = db
        .prepare(
          `SELECT cs.class_id, c.name AS class_name, cs.subject_id, s.name_kh AS subject_name
             FROM class_subjects cs JOIN classes c ON c.id = cs.class_id
             JOIN subjects s ON s.id = cs.subject_id
            ORDER BY c.grade_level, c.name, s.name_kh`,
        )
        .all();
      return res.json({ data: rows });
    }
    const rows = db
      .prepare(
        `SELECT cs.class_id, c.name AS class_name, cs.subject_id, s.name_kh AS subject_name
           FROM class_subjects cs JOIN classes c ON c.id = cs.class_id
           JOIN subjects s ON s.id = cs.subject_id
          WHERE cs.teacher_id = ? OR c.homeroom_teacher_id = ?
          ORDER BY c.grade_level, c.name, s.name_kh`,
      )
      .all(req.user!.id, req.user!.id);
    res.json({ data: rows });
  }),
);

export default router;
