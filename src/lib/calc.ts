import { store, type ScoreTypeRow, type StudentRow } from "./db";

export interface GradeInfo {
  grade: string;
  min: number;
  remark: string;
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

export interface SubjectRowLite {
  id: number;
  code: string;
  name_kh: string;
  name_en: string;
  credits: number;
}

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function getSettings(): Record<string, string> {
  return store().settings;
}

export function setSetting(key: string, value: string) {
  store().settings[key] = value;
}

export const DEFAULT_GRADE_SCALE: GradeInfo[] = [
  { grade: "A", min: 90, remark: "ល្អប្រសើរ" },
  { grade: "B", min: 80, remark: "ល្អ" },
  { grade: "C", min: 70, remark: "មធ្យមល្អ" },
  { grade: "D", min: 60, remark: "មធ្យម" },
  { grade: "E", min: 50, remark: "ខ្សោយ" },
  { grade: "F", min: 0, remark: "ធ្លាក់" },
];

export function getGradeScale(): GradeInfo[] {
  try {
    const raw = JSON.parse(getSettings().grade_scale ?? "[]") as GradeInfo[];
    if (Array.isArray(raw) && raw.length) return [...raw].sort((a, b) => b.min - a.min);
  } catch {
    /* fall back to the default scale */
  }
  return DEFAULT_GRADE_SCALE;
}

export function getScoreTypes(): ScoreTypeRow[] {
  return [...store().scoreTypes].sort((a, b) => a.sort - b.sort || a.id - b.id);
}

export function passMark(): number {
  return Number(getSettings().pass_mark ?? 50);
}

export function maxScore(): number {
  return Number(getSettings().max_score ?? 100);
}

export function gradeFor(average: number | null): GradeInfo | null {
  if (average === null || Number.isNaN(average)) return null;
  const scale = getGradeScale();
  return scale.find((g) => average >= g.min) ?? scale[scale.length - 1] ?? null;
}

export function currentTermId(): number | null {
  const data = store();
  const current = data.terms.find((t) => t.is_current === 1);
  if (current) return current.id;
  const withYear = data.terms
    .map((t) => ({ t, y: data.years.find((y) => y.id === t.academic_year_id) }))
    .sort((a, b) => (b.y?.name ?? "").localeCompare(a.y?.name ?? "") || a.t.semester - b.t.semester);
  return withYear[0]?.t.id ?? null;
}

export function currentYearId(): number | null {
  const data = store();
  const termId = currentTermId();
  const term = data.terms.find((t) => t.id === termId);
  if (term) return term.academic_year_id;
  const flag = data.years.find((y) => y.is_current === 1);
  if (flag) return flag.id;
  return data.years[0]?.id ?? null;
}

export function subjectsForClass(classId: number | null): SubjectRowLite[] {
  if (!classId) return [];
  const data = store();
  return data.classSubjects
    .filter((cs) => cs.class_id === classId)
    .map((cs) => data.subjects.find((s) => s.id === cs.subject_id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s) && s!.is_active === 1)
    .map((s) => ({ id: s.id, code: s.code, name_kh: s.name_kh, name_en: s.name_en, credits: s.credits }))
    .sort((a, b) => a.name_kh.localeCompare(b.name_kh, "km"));
}

const studentName = (s: StudentRow) => `${s.last_name_kh} ${s.first_name_kh}`;

/**
 * Full academic result of a class for one term.
 * Subject average = Σ(score × weight) / Σ(weight) over the assessments that
 * were entered, so a missing assessment does not unfairly penalise a student.
 */
export function computeClassResults(classId: number, termId: number) {
  const data = store();
  const scoreTypes = getScoreTypes();
  const subjects = subjectsForClass(classId);
  const scale = getGradeScale();
  const pass = passMark();
  const cls = data.classes.find((c) => c.id === classId);

  const gradeOf = (average: number | null) =>
    average === null || Number.isNaN(average)
      ? null
      : scale.find((g) => average >= g.min) ?? scale[scale.length - 1] ?? null;

  const students = data.students
    .filter((s) => s.class_id === classId && s.status === "active")
    .sort(
      (a, b) =>
        a.last_name_kh.localeCompare(b.last_name_kh, "km") ||
        a.first_name_kh.localeCompare(b.first_name_kh, "km"),
    );

  const weights = new Map(scoreTypes.map((t) => [t.code, t.weight]));
  const byType = new Map(scoreTypes.map((t) => [t.id, t.code]));

  const results: StudentResult[] = students.map((s) => {
    const mine = data.scores.filter((sc) => sc.student_id === s.id && sc.term_id === termId);

    const subjectResults: SubjectAverage[] = subjects.map((sub) => {
      const scores: Record<string, number | null> = {};
      for (const t of scoreTypes) scores[t.code] = null;
      let weighted = 0;
      let weightSum = 0;
      for (const sc of mine) {
        if (sc.subject_id !== sub.id) continue;
        const code = byType.get(sc.score_type_id);
        if (!code) continue;
        scores[code] = sc.score;
        const w = weights.get(code) ?? 1;
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
    const grade = gradeOf(average);

    return {
      student_id: s.id,
      code: s.code,
      name_kh: studentName(s),
      name_en: [s.first_name_en, s.last_name_en].filter(Boolean).join(" "),
      gender: s.gender,
      class_id: s.class_id,
      class_name: cls?.name ?? null,
      subjects: subjectResults,
      total: graded ? round(total) : null,
      average,
      grade: grade?.grade ?? null,
      remark: grade?.remark ?? null,
      passed: average === null ? null : average >= pass,
      rank: null,
      score_count: mine.length,
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
  const data = store();
  const student = data.students.find((s) => s.id === studentId);
  if (!student || !student.class_id) return null;
  const { students } = computeClassResults(student.class_id, termId);
  return students.find((s) => s.student_id === studentId) ?? null;
}

export interface AttendanceTally {
  student_id: number;
  present: number;
  absent: number;
  late: number;
  permission: number;
}

export function attendanceSummary(classId: number, from: string, to: string): AttendanceTally[] {
  const data = store();
  const students = data.students.filter((s) => s.class_id === classId && s.status === "active");
  return students.map((s) => {
    const rows = data.attendance.filter(
      (a) => a.student_id === s.id && a.date >= from && a.date <= to,
    );
    return {
      student_id: s.id,
      present: rows.filter((r) => r.status === "present").length,
      absent: rows.filter((r) => r.status === "absent").length,
      late: rows.filter((r) => r.status === "late").length,
      permission: rows.filter((r) => r.status === "permission").length,
    };
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
