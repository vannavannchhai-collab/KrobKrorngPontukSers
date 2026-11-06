import { Router } from "express";
import { db } from "../db.js";
import { authRequired } from "../auth.js";
import { asyncHandler, todayISO } from "../util.js";
import { computeClassResults, currentTermId, getGradeScale, passMark } from "../compute.js";

const router = Router();
router.use(authRequired);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const termId = Number(req.query.term_id) || currentTermId();
    const classes = db
      .prepare("SELECT id, name, grade_level FROM classes WHERE is_active = 1 ORDER BY grade_level, name")
      .all() as any[];

    const students = db
      .prepare("SELECT gender, status, class_id FROM students")
      .all() as any[];
    const counts = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM students WHERE status='active') AS students,
           (SELECT COUNT(*) FROM students WHERE status='active' AND gender='M') AS males,
           (SELECT COUNT(*) FROM students WHERE status='active' AND gender='F') AS females,
           (SELECT COUNT(*) FROM classes WHERE is_active=1) AS classes,
           (SELECT COUNT(*) FROM subjects WHERE is_active=1) AS subjects,
           (SELECT COUNT(*) FROM users WHERE role='teacher' AND is_active=1) AS teachers`,
      )
      .get() as any;

    const classResults = termId
      ? classes.map((c) => {
          const res = computeClassResults(c.id, termId);
          const avgs = res.students.map((s) => s.average).filter((a): a is number => a !== null);
          const pass = passMark();
          return {
            class_id: c.id,
            name: c.name,
            grade_level: c.grade_level,
            students: res.students.length,
            average: avgs.length ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100 : null,
            pass_rate: avgs.length
              ? Math.round((avgs.filter((a) => a >= pass).length / avgs.length) * 1000) / 10
              : null,
            highest: avgs.length ? Math.max(...avgs) : null,
          };
        })
      : [];

    const gradedStudents = termId
      ? classes.flatMap((c) => computeClassResults(c.id, termId).students)
      : [];
    const allAverages = gradedStudents.map((s) => s.average).filter((a): a is number => a !== null);
    const overallAverage = allAverages.length
      ? Math.round((allAverages.reduce((a, b) => a + b, 0) / allAverages.length) * 100) / 100
      : null;

    const gradeScale = getGradeScale();
    const bands = gradeScale.map((g) => ({
      grade: g.grade,
      label: g.remark,
      min: g.min,
      count: 0,
    }));
    for (const avg of allAverages) {
      const idx = gradeScale.findIndex((g) => avg >= g.min);
      const band = bands[idx === -1 ? bands.length - 1 : idx];
      if (band) band.count++;
    }

    // Subject-wide performance for the selected term.
    const subjectRows = db
      .prepare(
        `SELECT s.id, s.code, s.name_kh, s.color, AVG(sc.score) AS raw_average, COUNT(sc.id) AS score_count
           FROM scores sc
           JOIN subjects s ON s.id = sc.subject_id
          WHERE sc.term_id = ?
          GROUP BY s.id ORDER BY s.name_kh`,
      )
      .all(termId ?? 0) as any[];
    const subjectPerformance = subjectRows.map((s) => ({
      ...s,
      average: s.raw_average ? Math.round(s.raw_average * 100) / 100 : null,
    }));

    // Trend over all terms (school average).
    const terms = db
      .prepare(
        `SELECT t.id, t.name, t.semester, y.name AS year_name
           FROM terms t JOIN academic_years y ON y.id = t.academic_year_id
          ORDER BY y.name, t.semester`,
      )
      .all() as any[];
    const trend = terms.map((t) => {
      const clsRows = db
        .prepare("SELECT id FROM classes WHERE is_active = 1")
        .all() as any[];
      const avgs = clsRows
        .flatMap((c) => computeClassResults(c.id, t.id).students)
        .map((s) => s.average)
        .filter((a): a is number => a !== null);
      return {
        term_id: t.id,
        label: `${t.name}`,
        year: t.year_name,
        average: avgs.length ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100 : null,
      };
    }).filter((t) => t.average !== null);

    const topStudents = termId
      ? classes
          .flatMap((c) => computeClassResults(c.id, termId).students)
          .filter((s) => s.average !== null)
          .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
          .slice(0, 8)
          .map((s, i) => ({ ...s, school_rank: i + 1 }))
      : [];

    // Attendance for the current month.
    const month = todayISO().slice(0, 7);
    const att = db
      .prepare(
        `SELECT
           SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
           SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) AS absent,
           SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) AS late,
           SUM(CASE WHEN status='permission' THEN 1 ELSE 0 END) AS permission,
           COUNT(*) AS total
         FROM attendance WHERE date LIKE ?`,
      )
      .get(`${month}-%`) as any;
    const attendanceRate = att?.total
      ? Math.round(((att.present + att.late) / att.total) * 1000) / 10
      : null;

    const recentScores = db
      .prepare(
        `SELECT sc.updated_at AS at, u.name AS user_name, s.name_kh AS subject, c.name AS class_name,
                st.name_kh AS type_name, COUNT(*) AS count
           FROM scores sc
           LEFT JOIN users u ON u.id = sc.entered_by
           JOIN subjects s ON s.id = sc.subject_id
           JOIN classes c ON c.id = (SELECT class_id FROM students WHERE id = sc.student_id)
           JOIN score_types st ON st.id = sc.score_type_id
          GROUP BY sc.entered_by, sc.subject_id, c.id, sc.score_type_id
          ORDER BY MAX(sc.updated_at) DESC LIMIT 6`,
      )
      .all() as any[];

    const recentLogs = db
      .prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 8")
      .all() as any[];

    const attention = gradedStudents
      .filter((s) => s.average !== null && s.average < passMark())
      .sort((a, b) => (a.average ?? 0) - (b.average ?? 0))
      .slice(0, 6)
      .map((s) => ({ ...s }));

    res.json({
      counts: { ...counts, totalStudents: students.length },
      overallAverage,
      passRate: allAverages.length
        ? Math.round((allAverages.filter((a) => a >= passMark()).length / allAverages.length) * 1000) / 10
        : null,
      bands,
      subjectPerformance,
      classResults,
      trend,
      topStudents,
      attendance: { rate: attendanceRate, ...att },
      recentScores,
      recentLogs,
      attention,
      termId,
      term: termId ? db.prepare("SELECT * FROM terms WHERE id = ?").get(termId) : null,
      month,
    });
  }),
);

export default router;
