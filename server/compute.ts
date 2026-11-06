import { db, getSettings } from "./db.js";
import { round } from "./util.js";

export interface ScoreType {
  id: number;
  code: string;
  name_kh: string;
  name_en: string;
  weight: number;
  sort: number;
}

export interface GradeInfo {
  grade: string;
  min: number;
  remark: string;
}

export function getScoreTypes(): ScoreType[] {
  return db.prepare("SELECT * FROM score_types ORDER BY sort, id").all() as unknown as ScoreType[];
}

export function getGradeScale(): GradeInfo[] {
  try {
    const raw = JSON.parse(getSettings().grade_scale ?? "[]") as GradeInfo[];
    if (Array.isArray(raw) && raw.length) return [...raw].sort((a, b) => b.min - a.min);
  } catch {
    /* ignore */
  }
  return [
    { grade: "A", min: 90, remark: "ល្អប្រសើរ" },
    { grade: "B", min: 80, remark: "ល្អ" },
    { grade: "C", min: 70, remark: "មធ្យមល្អ" },
    { grade: "D", min: 60, remark: "មធ្យម" },
    { grade: "E", min: 50, remark: "ខ្សោយ" },
    { grade: "F", min: 0, remark: "ធ្លាក់" },
  ];
}

export function gradeFor(average: number | null): GradeInfo | null {
  if (average === null || Number.isNaN(average)) return null;
  const scale = getGradeScale();
  return scale.find((g) => average >= g.min) ?? scale[scale.length - 1];
}

export function passMark(): number {
  return Number(getSettings().pass_mark ?? 50);
}

export function currentTermId(): number | null {
  const row = db.prepare("SELECT id FROM terms WHERE is_current = 1 LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (row) return row.id;
  const fallback = db
    .prepare(
      `SELECT t.id FROM terms t JOIN academic_years y ON y.id = t.academic_year_id
        ORDER BY y.name DESC, t.semester ASC LIMIT 1`,
    )
    .get() as { id: number } | undefined;
  return fallback?.id ?? null;
}

export function termExists(termId: number) {
  return !!db.prepare("SELECT 1 FROM terms WHERE id = ?").get(termId);
}

export interface SubjectAverage {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  credits: number;
  average: number | null;
  scores: Record<string, number | null>;
}

export interface StudentResult {
  student_id: number;
  code: string;
  name_kh: string;
  name_en: string;
  gender: string;
  class_id: number | null;
  class_name: string | null;
  subjects: SubjectAverage[];
  total: number | null;
  average: number | null;
  grade: string | null;
  remark: string | null;
  passed: boolean | null;
  rank: number | null;
  score_count: number;
}

interface SubjectRow {
  id: number;
  code: string;
  name_kh: string;
  name_en: string;
  credits: number;
}

function subjectsForClass(classId: number | null): SubjectRow[] {
  if (!classId) return [];
  return db
    .prepare(
      `SELECT s.id, s.code, s.name_kh, s.name_en, s.credits
         FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id
        WHERE cs.class_id = ? AND s.is_active = 1
        ORDER BY s.name_kh`,
    )
    .all(classId) as unknown as SubjectRow[];
}

/**
 * Compute the full academic result of a class for a term.
 * Subject average = Σ(score × weight) / Σ(weight) over the score types that were entered,
 * so missing assessments do not unfairly penalise a student.
 */
export function computeClassResults(classId: number, termId: number): {
  students: StudentResult[];
  subjects: SubjectRow[];
  scoreTypes: ScoreType[];
  subjectAverages: { subject_id: number; code: string; name: string; average: number | null }[];
} {
  const scoreTypes = getScoreTypes();
  const subjects = subjectsForClass(classId);
  const students = db
    .prepare(
      `SELECT id, code, last_name_kh, first_name_kh, last_name_en, first_name_en, gender, class_id
         FROM students WHERE class_id = ? AND status = 'active'
        ORDER BY last_name_kh, first_name_kh`,
    )
    .all(classId) as unknown as {
    id: number;
    code: string;
    last_name_kh: string;
    first_name_kh: string;
    last_name_en: string | null;
    first_name_en: string | null;
    gender: string;
    class_id: number | null;
  }[];

  const rows = db
    .prepare(
      `SELECT sc.student_id, sc.subject_id, st.code AS type_code, sc.score
         FROM scores sc
         JOIN score_types st ON st.id = sc.score_type_id
         JOIN students s ON s.id = sc.student_id
        WHERE s.class_id = ? AND sc.term_id = ?`,
    )
    .all(classId, termId) as unknown as {
    student_id: number;
    subject_id: number;
    type_code: string;
    score: number;
  }[];

  const byStudent = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byStudent.get(r.student_id) ?? [];
    list.push(r);
    byStudent.set(r.student_id, list);
  }

  const weightOf = new Map(scoreTypes.map((t) => [t.code, t.weight]));

  const results: StudentResult[] = students.map((s) => {
    const studentScores = byStudent.get(s.id) ?? [];
    const subjectResults: SubjectAverage[] = subjects.map((sub) => {
      const scores: Record<string, number | null> = {};
      for (const t of scoreTypes) scores[t.code] = null;
      let weighted = 0;
      let weightSum = 0;
      for (const sc of studentScores) {
        if (sc.subject_id !== sub.id) continue;
        scores[sc.type_code] = sc.score;
        const w = weightOf.get(sc.type_code) ?? 1;
        weighted += sc.score * w;
        weightSum += w;
      }
      return {
        subject_id: sub.id,
        subject_code: sub.code,
        subject_name: sub.name_kh,
        credits: sub.credits,
        average: weightSum > 0 ? round(weighted / weightSum) : null,
        scores,
      };
    });

    let creditSum = 0;
    let totalWeighted = 0;
    let total = 0;
    let graded = 0;
    for (const sr of subjectResults) {
      if (sr.average === null) continue;
      creditSum += sr.credits;
      totalWeighted += sr.average * sr.credits;
      total += sr.average;
      graded++;
    }
    const average = creditSum > 0 ? round(totalWeighted / creditSum) : null;
    const grade = gradeFor(average);
    const pass = passMark();
    const classRow = db.prepare("SELECT name FROM classes WHERE id = ?").get(classId) as
      | { name: string }
      | undefined;

    return {
      student_id: s.id,
      code: s.code,
      name_kh: `${s.last_name_kh} ${s.first_name_kh}`,
      name_en: [s.first_name_en, s.last_name_en].filter(Boolean).join(" "),
      gender: s.gender,
      class_id: s.class_id,
      class_name: classRow?.name ?? null,
      subjects: subjectResults,
      total: graded ? round(total) : null,
      average,
      grade: grade?.grade ?? null,
      remark: grade?.remark ?? null,
      passed: average === null ? null : average >= pass,
      rank: null,
      score_count: studentScores.length,
    };
  });

  const ranked = [...results]
    .filter((r) => r.average !== null)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  let lastScore: number | null = null;
  let lastRank = 0;
  ranked.forEach((r, i) => {
    if (lastScore !== null && r.average === lastScore) {
      r.rank = lastRank; // ties share the same rank
    } else {
      r.rank = i + 1;
      lastRank = i + 1;
      lastScore = r.average;
    }
  });

  const subjectAverages = subjects.map((sub) => {
    const values = results
      .map((r) => r.subjects.find((x) => x.subject_id === sub.id)?.average ?? null)
      .filter((v): v is number => v !== null);
    return {
      subject_id: sub.id,
      code: sub.code,
      name: sub.name_kh,
      average: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null,
    };
  });

  return {
    students: results.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999)),
    subjects,
    scoreTypes,
    subjectAverages,
  };
}

export function computeStudentResult(studentId: number, termId: number): StudentResult | null {
  const row = db.prepare("SELECT class_id FROM students WHERE id = ?").get(studentId) as
    | { class_id: number | null }
    | undefined;
  if (!row) return null;
  if (!row.class_id) return null;
  const { students } = computeClassResults(row.class_id, termId);
  return students.find((s) => s.student_id === studentId) ?? null;
}

export function attendanceSummary(classId: number, from: string, to: string) {
  const rows = db
    .prepare(
      `SELECT student_id,
              SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
              SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) AS absent,
              SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) AS late,
              SUM(CASE WHEN status='permission' THEN 1 ELSE 0 END) AS permission
         FROM attendance
        WHERE class_id = ? AND date BETWEEN ? AND ?
        GROUP BY student_id`,
    )
    .all(classId, from, to) as unknown as {
    student_id: number;
    present: number;
    absent: number;
    late: number;
    permission: number;
  }[];
  const map = new Map(rows.map((r) => [r.student_id, r]));
  const students = db
    .prepare("SELECT id FROM students WHERE class_id = ? AND status = 'active'")
    .all(classId) as unknown as { id: number }[];
  return students.map((s) => ({
    student_id: s.id,
    present: map.get(s.id)?.present ?? 0,
    absent: map.get(s.id)?.absent ?? 0,
    late: map.get(s.id)?.late ?? 0,
    permission: map.get(s.id)?.permission ?? 0,
  }));
}
