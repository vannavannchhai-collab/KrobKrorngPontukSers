import { Router } from "express";
import { db, getSettings } from "../db.js";
import { authRequired } from "../auth.js";
import { HttpError, asyncHandler, toCsv } from "../util.js";
import {
  attendanceSummary,
  computeClassResults,
  computeStudentResult,
  currentTermId,
  getGradeScale,
  passMark,
} from "../compute.js";

const router = Router();
router.use(authRequired);

router.get(
  "/class",
  asyncHandler(async (req, res) => {
    const classId = Number(req.query.class_id);
    const termId = Number(req.query.term_id) || currentTermId();
    if (!classId || !termId) throw new HttpError(400, "សូមជ្រើសរើសថ្នាក់ និងឆមាស");
    const data = computeClassResults(classId, termId);
    const cls = db.prepare("SELECT * FROM classes WHERE id = ?").get(classId) as any;
    if (!cls) throw new HttpError(404, "រកមិនឃើញថ្នាក់");
    const term = db.prepare("SELECT * FROM terms WHERE id = ?").get(termId) as any;
    const homeroom = db
      .prepare("SELECT u.name FROM users u WHERE u.id = ?")
      .get(cls.homeroom_teacher_id) as any;
    const averages = data.students.map((s) => s.average).filter((a): a is number => a !== null);
    const pass = passMark();

    res.json({
      ...data,
      class: cls,
      term,
      homeroom: homeroom?.name ?? null,
      passMark: pass,
      gradeScale: getGradeScale(),
      stats: {
        count: data.students.length,
        graded: averages.length,
        average: averages.length
          ? Math.round((averages.reduce((a, b) => a + b, 0) / averages.length) * 100) / 100
          : null,
        highest: averages.length ? Math.max(...averages) : null,
        lowest: averages.length ? Math.min(...averages) : null,
        passed: averages.filter((a) => a >= pass).length,
        failed: averages.filter((a) => a < pass).length,
        passRate: averages.length
          ? Math.round((averages.filter((a) => a >= pass).length / averages.length) * 1000) / 10
          : null,
        males: data.students.filter((s) => s.gender === "M").length,
        females: data.students.filter((s) => s.gender === "F").length,
      },
    });
  }),
);

router.get(
  "/student/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const termId = Number(req.query.term_id) || currentTermId();
    if (!termId) throw new HttpError(400, "មិនមានឆមាសសិក្សា");
    const student = db
      .prepare(
        `SELECT s.*, c.name AS class_name, c.grade_level, c.room,
                u.name AS homeroom_name
           FROM students s LEFT JOIN classes c ON c.id = s.class_id
           LEFT JOIN users u ON u.id = c.homeroom_teacher_id
          WHERE s.id = ?`,
      )
      .get(id) as any;
    if (!student) throw new HttpError(404, "រកមិនឃើញសិស្ស");
    const result = computeStudentResult(id, termId);
    const term = db.prepare("SELECT * FROM terms WHERE id = ?").get(termId) as any;
    const year = term
      ? (db.prepare("SELECT * FROM academic_years WHERE id = ?").get(term.academic_year_id) as any)
      : null;
    const settings = getSettings();
    const attendance = student.class_id
      ? attendanceSummary(
          student.class_id,
          term?.start_date ?? "0000-01-01",
          term?.end_date ?? "9999-12-31",
        ).find((a) => a.student_id === id) ?? null
      : null;
    const classSize = student.class_id
      ? (db.prepare("SELECT COUNT(*) AS c FROM students WHERE class_id = ? AND status='active'").get(student.class_id) as any).c
      : 0;

    const teacherMap: Record<number, string | null> = {};
    if (student.class_id) {
      const rows = db
        .prepare(
          `SELECT cs.subject_id, u.name FROM class_subjects cs LEFT JOIN users u ON u.id = cs.teacher_id
            WHERE cs.class_id = ?`,
        )
        .all(student.class_id) as any[];
      for (const r of rows) teacherMap[r.subject_id] = r.name ?? null;
    }

    res.json({
      student,
      result,
      term,
      year,
      attendance,
      classSize,
      settings: {
        school_name: settings.school_name,
        school_name_en: settings.school_name_en,
        school_address: settings.school_address,
        school_phone: settings.school_phone,
        school_email: settings.school_email,
        director_name: settings.director_name,
        motto: settings.motto,
        pass_mark: Number(settings.pass_mark),
      },
      gradeScale: getGradeScale(),
      teacherMap,
    });
  }),
);

/** Full transcript: every term the student has scores in. */
router.get(
  "/transcript/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const student = db
      .prepare(
        `SELECT s.*, c.name AS class_name FROM students s LEFT JOIN classes c ON c.id = s.class_id
          WHERE s.id = ?`,
      )
      .get(id) as any;
    if (!student) throw new HttpError(404, "រកមិនឃើញសិស្ស");
    const terms = db.prepare("SELECT * FROM terms ORDER BY academic_year_id, semester").all() as any[];
    const rows = terms
      .map((t) => {
        const r = computeStudentResult(id, t.id);
        const year = db.prepare("SELECT name FROM academic_years WHERE id = ?").get(t.academic_year_id) as any;
        return {
          term_id: t.id,
          term_name: t.name,
          year_name: year?.name ?? "",
          semester: t.semester,
          average: r?.average ?? null,
          grade: r?.grade ?? null,
          rank: r?.rank ?? null,
          passed: r?.passed ?? null,
        };
      })
      .filter((r) => r.average !== null);
    res.json({ student, rows, settings: getSettings(), gradeScale: getGradeScale() });
  }),
);

/** School-wide leaderboard for one term. */
router.get(
  "/ranking",
  asyncHandler(async (req, res) => {
    const termId = Number(req.query.term_id) || currentTermId();
    const limit = Math.min(100, Number(req.query.limit) || 10);
    const gradeLevel = req.query.grade_level ? Number(req.query.grade_level) : null;
    if (!termId) return res.json({ data: [] });
    const classes = db
      .prepare(
        `SELECT id FROM classes WHERE is_active = 1 ${gradeLevel ? "AND grade_level = ?" : ""}`,
      )
      .all(...(gradeLevel ? [gradeLevel] : [])) as any[];
    const all = classes.flatMap((c) =>
      computeClassResults(c.id, termId).students.map((s) => ({ ...s, rank_in_class: s.rank })),
    );
    const sorted = all
      .filter((s) => s.average !== null)
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
      .slice(0, limit)
      .map((s, i) => ({ ...s, school_rank: i + 1 }));
    res.json({ data: sorted, termId });
  }),
);

router.get(
  "/export/csv",
  asyncHandler(async (req, res) => {
    const classId = Number(req.query.class_id);
    const termId = Number(req.query.term_id) || currentTermId();
    if (!classId || !termId) throw new HttpError(400, "សូមជ្រើសរើសថ្នាក់");
    const data = computeClassResults(classId, termId);
    const cls = db.prepare("SELECT name FROM classes WHERE id = ?").get(classId) as any;
    const rows = data.students.map((s) => {
      const row: Record<string, unknown> = {
        rank: s.rank,
        code: s.code,
        name: s.name_kh,
        gender: s.gender === "M" ? "ប្រុស" : "ស្រី",
      };
      for (const sub of s.subjects) row[sub.subject_code] = sub.average ?? "";
      row.total = s.total ?? "";
      row.average = s.average ?? "";
      row.grade = s.grade ?? "";
      row.remark = s.remark ?? "";
      return row;
    });
    const headers = [
      { key: "rank", label: "ចំណាត់ថ្នាក់" },
      { key: "code", label: "កូដសិស្ស" },
      { key: "name", label: "ឈ្មោះសិស្ស" },
      { key: "gender", label: "ភេទ" },
      ...data.subjects.map((s) => ({ key: s.code, label: s.name_kh })),
      { key: "total", label: "សរុប" },
      { key: "average", label: "មធ្យមភាគ" },
      { key: "grade", label: "និទ្ទេស" },
      { key: "remark", label: "ការវាយតម្លៃ" },
    ];
    const csv = toCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="results-${cls?.name ?? classId}-${termId}.csv"`,
    );
    res.send(csv);
  }),
);

export default router;
