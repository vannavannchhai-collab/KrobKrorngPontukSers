/**
 * Local API — a browser-side replacement for the old Express REST server.
 *
 * Pages call `api("/students", { query: {...} })` exactly like before; the
 * request is resolved against the localStorage document instead of the
 * network. Response shapes are identical to the previous server so no page
 * needed to change beyond the auth screens.
 */
import {
  HttpError,
  STANDARD_SUBJECTS,
  audit,
  commit,
  nextId,
  store,
  timestamp,
  type ClassSubjectRow,
  type StudentRow,
  type TeacherRow,
} from "./db";
import {
  attendanceSummary,
  computeClassResults,
  computeStudentResult,
  currentTermId,
  currentYearId,
  getGradeScale,
  getScoreTypes,
  getSettings,
  maxScore,
  passMark,
  round,
  setSetting,
  todayISO,
  type GradeInfo,
} from "./calc";

export interface ApiRequest {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  query: Record<string, string>;
  body: Record<string, unknown>;
}

const nameOf = (s: StudentRow) => `${s.last_name_kh} ${s.first_name_kh}`;
const teacherName = (id: number | null) =>
  id ? store().teachers.find((t) => t.id === id)?.name ?? null : null;

function qNum(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function paginate(query: Record<string, string>, defaultLimit = 20) {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const raw = Number.parseInt(query.limit ?? String(defaultLimit), 10) || defaultLimit;
  const limit = Math.min(500, Math.max(1, raw));
  return { page, limit, offset: (page - 1) * limit };
}

/* --------------------------------- meta ---------------------------------- */

function meta(req: ApiRequest) {
  const data = store();
  const years = [...data.years].sort((a, b) => b.name.localeCompare(a.name));
  const terms = [...data.terms].sort(
    (a, b) => b.academic_year_id - a.academic_year_id || a.semester - b.semester,
  );
  const classes = [...data.classes]
    .sort((a, b) => a.grade_level - b.grade_level || a.name.localeCompare(b.name, "km"))
    .map((c) => ({
      ...c,
      homeroom_name: teacherName(c.homeroom_teacher_id),
      student_count: data.students.filter((s) => s.class_id === c.id && s.status === "active").length,
    }));
  const subjects = [...data.subjects].sort((a, b) => a.name_kh.localeCompare(b.name_kh, "km"));
  const teachers = data.teachers
    .filter((t) => t.is_active === 1)
    .map((t) => ({
      id: t.id,
      name: t.name,
      name_en: t.name_en,
      role: "teacher" as const,
      is_active: t.is_active,
      subject_id: t.subject_id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "km"));
  const assignments = data.classSubjects.map((cs) => ({
    id: cs.id,
    class_id: cs.class_id,
    subject_id: cs.subject_id,
    teacher_id: cs.teacher_id,
    teacher_name: teacherName(cs.teacher_id),
  }));

  const settings = getSettings();
  const termId = currentTermId();
  const term = data.terms.find((t) => t.id === termId) ?? null;
  const yearId = currentYearId();

  const teacherFilter = qNum(req.query.teacher_id);

  return {
    years,
    terms,
    classes,
    subjects,
    teachers: teacherFilter ? teachers.filter((t) => t.id === teacherFilter) : teachers,
    assignments,
    scoreTypes: getScoreTypes(),
    gradeScale: getGradeScale(),
    settings: {
      school_name: settings.school_name ?? "",
      school_name_en: settings.school_name_en ?? "",
      school_address: settings.school_address ?? "",
      school_phone: settings.school_phone ?? "",
      school_email: settings.school_email ?? "",
      director_name: settings.director_name ?? "",
      motto: settings.motto ?? "",
      pass_mark: Number(settings.pass_mark ?? 50),
      max_score: Number(settings.max_score ?? 100),
      attendance_absent_limit: Number(settings.attendance_absent_limit ?? 20),
      locale: settings.locale ?? "km-KH",
      academic_year_id: yearId,
      term_id: term?.id ?? null,
    },
  };
}

/* -------------------------------- students -------------------------------- */

function studentRows(query: Record<string, string>) {
  const data = store();
  const search = (query.search ?? "").trim().toLowerCase();
  const classId = qNum(query.class_id);
  const gender = query.gender ?? "";
  const status = query.status ?? "";
  const grade = qNum(query.grade_level);

  const filtered = data.students.filter((s) => {
    const cls = data.classes.find((c) => c.id === s.class_id);
    if (classId && s.class_id !== classId) return false;
    if (gender && s.gender !== gender) return false;
    if (status && s.status !== status) return false;
    if (grade && cls?.grade_level !== grade) return false;
    if (search) {
      const hay = [
        s.last_name_kh,
        s.first_name_kh,
        s.last_name_en,
        s.first_name_en,
        s.code,
        s.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const sort = query.sort ?? "class";
  const withClass = filtered.map((s) => ({
    s,
    cls: data.classes.find((c) => c.id === s.class_id) ?? null,
  }));
  withClass.sort((a, b) => {
    if (sort === "name") return a.s.last_name_kh.localeCompare(b.s.last_name_kh, "km");
    if (sort === "code") return a.s.code.localeCompare(b.s.code);
    if (sort === "newest") return b.s.created_at.localeCompare(a.s.created_at);
    return (
      (a.cls?.grade_level ?? 99) - (b.cls?.grade_level ?? 99) ||
      (a.cls?.name ?? "").localeCompare(b.cls?.name ?? "", "km") ||
      a.s.last_name_kh.localeCompare(b.s.last_name_kh, "km")
    );
  });
  return withClass;
}

function listStudents(req: ApiRequest) {
  const { page, limit, offset } = paginate(req.query, 20);
  const rows = studentRows(req.query);
  const termId = qNum(req.query.term_id) ?? currentTermId();
  const data = store();

  const cache = new Map<number, ReturnType<typeof computeClassResults>>();
  const enriched = rows.slice(offset, offset + limit).map(({ s, cls }) => {
    let avg: number | null = null;
    let rank: number | null = null;
    let gradeName: string | null = null;
    if (s.class_id && termId) {
      let res = cache.get(s.class_id);
      if (!res) {
        res = computeClassResults(s.class_id, termId);
        cache.set(s.class_id, res);
      }
      const mine = res.students.find((x) => x.student_id === s.id);
      avg = mine?.average ?? null;
      rank = mine?.rank ?? null;
      gradeName = mine?.grade ?? null;
    }
    return {
      ...s,
      class_name: cls?.name ?? null,
      grade_level: cls?.grade_level ?? null,
      name_kh: nameOf(s),
      average: avg,
      rank,
      grade: gradeName,
    };
  });

  const summary = {
    total: rows.length,
    male: rows.filter((r) => r.s.gender === "M").length,
    female: rows.filter((r) => r.s.gender === "F").length,
    active: rows.filter((r) => r.s.status === "active").length,
  };

  void data;
  return { data: enriched, total: rows.length, page, limit, summary, termId };
}

function getStudent(req: ApiRequest, id: number) {
  const data = store();
  const student = data.students.find((s) => s.id === id);
  if (!student) throw new HttpError(404, "រកមិនឃើញសិស្ស");
  const cls = data.classes.find((c) => c.id === student.class_id) ?? null;
  const termId = qNum(req.query.term_id) ?? currentTermId();
  const result = termId ? computeStudentResult(id, termId) : null;

  const history = [...data.terms]
    .sort((a, b) => a.academic_year_id - b.academic_year_id || a.semester - b.semester)
    .map((t) => {
      const r = computeStudentResult(id, t.id);
      return {
        term_id: t.id,
        term_name: t.name,
        semester: t.semester,
        average: r?.average ?? null,
        rank: r?.rank ?? null,
        grade: r?.grade ?? null,
        passed: r?.passed ?? null,
        subject_count: r?.subjects.filter((s) => s.average !== null).length ?? 0,
      };
    });

  const term = termId ? data.terms.find((t) => t.id === termId) ?? null : null;
  const attendance = student.class_id
    ? attendanceSummary(
        student.class_id,
        term?.start_date ?? "0000-01-01",
        term?.end_date ?? "9999-12-31",
      ).find((a) => a.student_id === id) ?? null
    : null;

  return {
    student: {
      ...student,
      class_name: cls?.name ?? null,
      grade_level: cls?.grade_level ?? null,
      name_kh: nameOf(student),
    },
    result,
    history,
    attendance,
    classSize: student.class_id
      ? data.students.filter((s) => s.class_id === student.class_id && s.status === "active").length
      : 0,
    className: cls?.name ?? null,
    homeroom: teacherName(cls?.homeroom_teacher_id ?? null),
  };
}

function nextStudentCode(): string {
  const data = store();
  const max = data.students.reduce((m, s) => {
    const match = /^STU-(\d+)$/.exec(s.code);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `STU-${String(max + 1).padStart(4, "0")}`;
}

function createStudent(body: Record<string, unknown>) {
  const data = store();
  const last = String(body.last_name_kh ?? "").trim();
  const first = String(body.first_name_kh ?? "").trim();
  if (!last || !first) throw new HttpError(400, "សូមបញ្ចូលនាមត្រកូល និងនាមខ្លួន");
  const gender = String(body.gender ?? "");
  if (gender !== "M" && gender !== "F") throw new HttpError(400, "សូមជ្រើសរើសភេទ");

  const code = String(body.code ?? "").trim() || nextStudentCode();
  if (data.students.some((s) => s.code === code)) throw new HttpError(409, "កូដសិស្សនេះមានរួចហើយ");

  const row: StudentRow = {
    id: nextId(),
    code,
    last_name_kh: last,
    first_name_kh: first,
    last_name_en: (body.last_name_en as string) || null,
    first_name_en: (body.first_name_en as string) || null,
    gender,
    dob: (body.dob as string) || null,
    class_id: qNum(body.class_id),
    phone: (body.phone as string) || null,
    guardian_name: (body.guardian_name as string) || null,
    guardian_phone: (body.guardian_phone as string) || null,
    address: (body.address as string) || null,
    enroll_date: (body.enroll_date as string) || todayISO(),
    status: (body.status as StudentRow["status"]) || "active",
    note: (body.note as string) || null,
    created_at: timestamp(),
  };
  data.students.push(row);
  audit("create", "student", row.id, `បន្ថែមសិស្ស ${last} ${first}`);
  commit();
  return { id: row.id, code };
}

function updateStudent(id: number, body: Record<string, unknown>) {
  const data = store();
  const row = data.students.find((s) => s.id === id);
  if (!row) throw new HttpError(404, "រកមិនឃើញសិស្ស");
  const code = String(body.code ?? "").trim();
  if (code && data.students.some((s) => s.code === code && s.id !== id)) {
    throw new HttpError(409, "កូដសិស្សនេះមានរួចហើយ");
  }
  const assign = <K extends keyof StudentRow>(key: K, value: StudentRow[K] | undefined, fallback = row[key]) => {
    row[key] = (value === undefined ? fallback : value) as StudentRow[K];
  };

  if (code) row.code = code;
  assign("last_name_kh", body.last_name_kh as string | undefined);
  assign("first_name_kh", body.first_name_kh as string | undefined);
  assign("last_name_en", (body.last_name_en as string) || null);
  assign("first_name_en", (body.first_name_en as string) || null);
  assign("gender", body.gender as StudentRow["gender"] | undefined);
  assign("dob", (body.dob as string) || null);
  assign("class_id", qNum(body.class_id));
  assign("phone", (body.phone as string) || null);
  assign("guardian_name", (body.guardian_name as string) || null);
  assign("guardian_phone", (body.guardian_phone as string) || null);
  assign("address", (body.address as string) || null);
  assign("enroll_date", (body.enroll_date as string) || null);
  assign("status", body.status as StudentRow["status"] | undefined);
  assign("note", (body.note as string) || null);

  audit("update", "student", id, `កែប្រែព័ត៌មានសិស្ស ${row.last_name_kh}`);
  commit();
  return { ok: true };
}

function deleteStudent(id: number) {
  const data = store();
  const row = data.students.find((s) => s.id === id);
  if (!row) throw new HttpError(404, "រកមិនឃើញសិស្ស");
  data.students = data.students.filter((s) => s.id !== id);
  data.scores = data.scores.filter((sc) => sc.student_id !== id);
  data.attendance = data.attendance.filter((a) => a.student_id !== id);
  audit("delete", "student", id, `លុបសិស្ស ${row.last_name_kh} ${row.first_name_kh}`);
  commit();
  return { ok: true };
}

function transferStudents(body: Record<string, unknown>) {
  const data = store();
  const ids = Array.isArray(body.student_ids) ? body.student_ids.map(Number) : [];
  if (!ids.length) throw new HttpError(400, "សូមជ្រើសរើសសិស្ស");
  const classId = body.class_id === null || body.class_id === "" ? null : qNum(body.class_id);
  for (const s of data.students) if (ids.includes(s.id)) s.class_id = classId;
  audit("update", "student", null, `ផ្ទេរសិស្ស ${ids.length} នាក់ទៅថ្នាក់ថ្មី`);
  commit();
  return { ok: true, moved: ids.length };
}

/* --------------------------------- scores --------------------------------- */

function scoreGrid(req: ApiRequest) {
  const data = store();
  const classId = qNum(req.query.class_id);
  const subjectId = qNum(req.query.subject_id);
  const termId = qNum(req.query.term_id) ?? currentTermId();
  if (!classId || !subjectId || !termId) {
    throw new HttpError(400, "សូមជ្រើសរើសថ្នាក់ មុខវិជ្ជា និងឆមាស");
  }
  const students = data.students
    .filter((s) => s.class_id === classId && s.status === "active")
    .sort((a, b) => a.last_name_kh.localeCompare(b.last_name_kh, "km"))
    .map((s) => ({
      id: s.id,
      code: s.code,
      last_name_kh: s.last_name_kh,
      first_name_kh: s.first_name_kh,
      gender: s.gender,
      name_kh: nameOf(s),
    }));

  const scoreTypes = getScoreTypes();
  const byId = new Map(scoreTypes.map((t) => [t.id, t.code]));
  const scores: Record<string, number> = {};
  const updatedAt = new Map<string, string>();
  let lastUpdate: string | null = null;
  for (const sc of data.scores) {
    if (sc.subject_id !== subjectId || sc.term_id !== termId) continue;
    const code = byId.get(sc.score_type_id);
    if (!code) continue;
    const key = `${sc.student_id}|${code}`;
    scores[key] = sc.score;
    updatedAt.set(key, sc.updated_at);
    if (!lastUpdate || sc.updated_at > lastUpdate) lastUpdate = sc.updated_at;
  }

  const cs = data.classSubjects.find((x) => x.class_id === classId && x.subject_id === subjectId);

  return {
    students,
    scoreTypes,
    scores,
    canEdit: true,
    subject: data.subjects.find((s) => s.id === subjectId) ?? null,
    class: data.classes.find((c) => c.id === classId) ?? null,
    term: data.terms.find((t) => t.id === termId) ?? null,
    teacherName: cs ? teacherName(cs.teacher_id) : null,
    lastUpdate,
    maxScore: maxScore(),
  };
}

function saveScores(body: Record<string, unknown>) {
  const data = store();
  const classId = qNum(body.class_id);
  const subjectId = qNum(body.subject_id);
  const termId = qNum(body.term_id);
  const entries = body.entries;
  if (!classId || !subjectId || !termId) throw new HttpError(400, "ព័ត៌មានមិនគ្រប់គ្រាន់");
  if (!Array.isArray(entries) || !entries.length) throw new HttpError(400, "គ្មានពិន្ទុត្រូវរក្សាទុក");

  const max = maxScore();
  const typeIds = new Set(data.scoreTypes.map((t) => t.id));
  const studentIds = new Set(data.students.filter((s) => s.class_id === classId).map((s) => s.id));

  let saved = 0;
  for (const raw of entries as Record<string, unknown>[]) {
    const studentId = Number(raw.student_id);
    const typeId = Number(raw.score_type_id);
    if (!studentIds.has(studentId)) throw new HttpError(400, "សិស្សមិនស្ថិតក្នុងថ្នាក់នេះ");
    if (!typeIds.has(typeId)) throw new HttpError(400, "ប្រភេទពិន្ទុមិនត្រឹមត្រូវ");

    const existing = data.scores.find(
      (s) =>
        s.student_id === studentId &&
        s.subject_id === subjectId &&
        s.term_id === termId &&
        s.score_type_id === typeId,
    );

    if (raw.score === null || raw.score === "" || raw.score === undefined) {
      if (existing) data.scores = data.scores.filter((s) => s !== existing);
      continue;
    }
    const value = Number(raw.score);
    if (Number.isNaN(value) || value < 0 || value > max) {
      throw new HttpError(400, `ពិន្ទុត្រូវនៅចន្លោះ 0 ដល់ ${max}`);
    }
    if (existing) {
      existing.score = value;
      existing.updated_at = timestamp();
    } else {
      data.scores.push({
        id: nextId(),
        student_id: studentId,
        subject_id: subjectId,
        term_id: termId,
        score_type_id: typeId,
        score: value,
        updated_at: timestamp(),
      });
    }
    saved++;
  }

  const cls = data.classes.find((c) => c.id === classId);
  const sub = data.subjects.find((s) => s.id === subjectId);
  audit(
    "update",
    "score",
    subjectId,
    `រក្សាទុកពិន្ទុ ${saved} កំណត់ — ${cls?.name ?? ""} / ${sub?.name_kh ?? ""}`,
  );
  commit();
  return { ok: true, saved };
}

function myAssignments() {
  const data = store();
  const rows = data.classSubjects
    .map((cs) => {
      const cls = data.classes.find((c) => c.id === cs.class_id);
      const sub = data.subjects.find((s) => s.id === cs.subject_id);
      if (!cls || !sub) return null;
      return {
        class_id: cs.class_id,
        class_name: cls.name,
        subject_id: cs.subject_id,
        subject_name: sub.name_kh,
        grade_level: cls.grade_level,
      };
    })
    .filter(Boolean) as {
    class_id: number;
    class_name: string;
    subject_id: number;
    subject_name: string;
    grade_level: number;
  }[];
  rows.sort(
    (a, b) =>
      a.grade_level - b.grade_level ||
      a.class_name.localeCompare(b.class_name, "km") ||
      a.subject_name.localeCompare(b.subject_name, "km"),
  );
  return { data: rows };
}

function studentScores(id: number) {
  const data = store();
  const rows = data.scores
    .filter((s) => s.student_id === id)
    .map((s) => {
      const type = data.scoreTypes.find((t) => t.id === s.score_type_id);
      const subject = data.subjects.find((x) => x.id === s.subject_id);
      const term = data.terms.find((t) => t.id === s.term_id);
      return {
        ...s,
        type_code: type?.code ?? "",
        type_name: type?.name_kh ?? "",
        weight: type?.weight ?? 0,
        subject_name: subject?.name_kh ?? "",
        term_name: term?.name ?? "",
        term_id: s.term_id,
      };
    });
  return { data: rows };
}

/* -------------------------------- results --------------------------------- */

function classResults(req: ApiRequest) {
  const data = store();
  const classId = qNum(req.query.class_id);
  const termId = qNum(req.query.term_id) ?? currentTermId();
  if (!classId || !termId) throw new HttpError(400, "សូមជ្រើសរើសថ្នាក់ និងឆមាស");
  const cls = data.classes.find((c) => c.id === classId);
  if (!cls) throw new HttpError(404, "រកមិនឃើញថ្នាក់");
  const term = data.terms.find((t) => t.id === termId) ?? null;
  const results = computeClassResults(classId, termId);
  const averages = results.students.map((s) => s.average).filter((a): a is number => a !== null);
  const pass = passMark();

  return {
    ...results,
    class: cls,
    term,
    homeroom: teacherName(cls.homeroom_teacher_id),
    passMark: pass,
    gradeScale: getGradeScale(),
    stats: {
      count: results.students.length,
      graded: averages.length,
      average: averages.length ? round(averages.reduce((a, b) => a + b, 0) / averages.length) : null,
      highest: averages.length ? Math.max(...averages) : null,
      lowest: averages.length ? Math.min(...averages) : null,
      passed: averages.filter((a) => a >= pass).length,
      failed: averages.filter((a) => a < pass).length,
      passRate: averages.length
        ? Math.round((averages.filter((a) => a >= pass).length / averages.length) * 1000) / 10
        : null,
      males: results.students.filter((s) => s.gender === "M").length,
      females: results.students.filter((s) => s.gender === "F").length,
    },
  };
}

function studentReport(req: ApiRequest, id: number) {
  const data = store();
  const student = data.students.find((s) => s.id === id);
  if (!student) throw new HttpError(404, "រកមិនឃើញសិស្ស");
  const termId = qNum(req.query.term_id) ?? currentTermId();
  if (!termId) throw new HttpError(400, "មិនមានឆមាសសិក្សា");
  const cls = data.classes.find((c) => c.id === student.class_id) ?? null;
  const term = data.terms.find((t) => t.id === termId) ?? null;
  const year = term ? data.years.find((y) => y.id === term.academic_year_id) ?? null : null;
  const settings = getSettings();
  const result = computeStudentResult(id, termId);

  const attendance = student.class_id
    ? attendanceSummary(
        student.class_id,
        term?.start_date ?? "0000-01-01",
        term?.end_date ?? "9999-12-31",
      ).find((a) => a.student_id === id) ?? null
    : null;

  const teacherMap: Record<number, string | null> = {};
  if (student.class_id) {
    for (const cs of data.classSubjects.filter((x) => x.class_id === student.class_id)) {
      teacherMap[cs.subject_id] = teacherName(cs.teacher_id);
    }
  }

  return {
    student: {
      ...student,
      class_name: cls?.name ?? null,
      grade_level: cls?.grade_level ?? null,
      room: cls?.room ?? null,
      homeroom_name: teacherName(cls?.homeroom_teacher_id ?? null),
    },
    result,
    term,
    year,
    attendance,
    classSize: student.class_id
      ? data.students.filter((s) => s.class_id === student.class_id && s.status === "active").length
      : 0,
    settings: {
      school_name: settings.school_name ?? "",
      school_name_en: settings.school_name_en ?? "",
      school_address: settings.school_address ?? "",
      school_phone: settings.school_phone ?? "",
      school_email: settings.school_email ?? "",
      director_name: settings.director_name ?? "",
      motto: settings.motto ?? "",
      pass_mark: Number(settings.pass_mark ?? 50),
    },
    gradeScale: getGradeScale(),
    teacherMap,
  };
}

function transcript(id: number) {
  const data = store();
  const student = data.students.find((s) => s.id === id);
  if (!student) throw new HttpError(404, "រកមិនឃើញសិស្ស");
  const cls = data.classes.find((c) => c.id === student.class_id);
  const rows = [...data.terms]
    .sort((a, b) => a.academic_year_id - b.academic_year_id || a.semester - b.semester)
    .map((t) => {
      const r = computeStudentResult(id, t.id);
      const year = data.years.find((y) => y.id === t.academic_year_id);
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

  return {
    student: { ...student, class_name: cls?.name ?? null, name_kh: nameOf(student) },
    rows,
    settings: getSettings(),
    gradeScale: getGradeScale(),
  };
}

function ranking(req: ApiRequest) {
  const data = store();
  const termId = qNum(req.query.term_id) ?? currentTermId();
  const limit = Math.min(100, qNum(req.query.limit) ?? 10);
  const gradeLevel = qNum(req.query.grade_level);
  if (!termId) return { data: [], termId };

  const classes = data.classes.filter(
    (c) => c.is_active === 1 && (!gradeLevel || c.grade_level === gradeLevel),
  );
  const all = classes.flatMap((c) =>
    computeClassResults(c.id, termId).students.map((s) => ({ ...s, rank_in_class: s.rank })),
  );
  const sorted = all
    .filter((s) => s.average !== null)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
    .slice(0, limit)
    .map((s, i) => ({ ...s, school_rank: i + 1 }));
  return { data: sorted, termId };
}

/* ------------------------------- attendance ------------------------------- */

const STATUSES = ["present", "absent", "late", "permission"] as const;

function studentLite(clsId: number) {
  return store()
    .students.filter((s) => s.class_id === clsId && s.status === "active")
    .sort((a, b) => a.last_name_kh.localeCompare(b.last_name_kh, "km"))
    .map((s) => ({
      id: s.id,
      code: s.code,
      last_name_kh: s.last_name_kh,
      first_name_kh: s.first_name_kh,
      gender: s.gender,
      name_kh: nameOf(s),
    }));
}

function attendanceDay(req: ApiRequest) {
  const data = store();
  const classId = qNum(req.query.class_id);
  const date = req.query.date || todayISO();
  if (!classId) throw new HttpError(400, "សូមជ្រើសរើសថ្នាក់");
  const records: Record<number, { status: string; note: string | null }> = {};
  const rows = data.attendance.filter((a) => a.class_id === classId && a.date === date);
  for (const r of rows) records[r.student_id] = { status: r.status, note: r.note };
  return {
    students: studentLite(classId),
    date,
    classId,
    records,
    canEdit: true,
    marked: rows.length,
  };
}

function saveAttendance(body: Record<string, unknown>) {
  const data = store();
  const classId = qNum(body.class_id);
  const date = String(body.date ?? todayISO());
  const entries = body.entries;
  if (!classId || !Array.isArray(entries)) throw new HttpError(400, "ព័ត៌មានមិនគ្រប់គ្រាន់");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "កាលបរិច្ឆេទមិនត្រឹមត្រូវ");
  const valid = new Set(data.students.filter((s) => s.class_id === classId).map((s) => s.id));

  let saved = 0;
  for (const raw of entries as Record<string, unknown>[]) {
    const studentId = Number(raw.student_id);
    if (!valid.has(studentId)) throw new HttpError(400, "សិស្សមិនស្ថិតក្នុងថ្នាក់នេះ");
    if (!STATUSES.includes(raw.status as (typeof STATUSES)[number])) {
      throw new HttpError(400, "ស្ថានភាពវត្តមានមិនត្រឹមត្រូវ");
    }
    const existing = data.attendance.find((a) => a.student_id === studentId && a.date === date);
    if (existing) {
      existing.status = raw.status as (typeof STATUSES)[number];
      existing.note = (raw.note as string) || null;
      existing.class_id = classId;
      existing.updated_at = timestamp();
    } else {
      data.attendance.push({
        id: nextId(),
        student_id: studentId,
        class_id: classId,
        date,
        status: raw.status as (typeof STATUSES)[number],
        note: (raw.note as string) || null,
        updated_at: timestamp(),
      });
    }
    saved++;
  }
  const cls = data.classes.find((c) => c.id === classId);
  audit("update", "attendance", classId, `កត់ត្រាវត្តមាន ${cls?.name ?? ""} ថ្ងៃ ${date}`);
  commit();
  return { ok: true, saved };
}

function attendanceMonthly(req: ApiRequest) {
  const data = store();
  const classId = qNum(req.query.class_id);
  const month = req.query.month || todayISO().slice(0, 7);
  if (!classId) throw new HttpError(400, "សូមជ្រើសរើសថ្នាក់");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "ខែមិនត្រឹមត្រូវ");
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter(
    (day) => {
      const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
      return dow !== 0 && dow !== 6;
    },
  );

  const students = studentLite(classId).map((s) => {
    const rec: Record<string, string> = {};
    for (const a of data.attendance) {
      if (a.student_id === s.id && a.date.startsWith(`${month}-`)) rec[a.date] = a.status;
    }
    const count = (st: string) => days.filter((d) => rec[d] === st).length;
    return {
      ...s,
      days: rec,
      present: count("present"),
      absent: count("absent"),
      late: count("late"),
      permission: count("permission"),
    };
  });

  return { days, month, students, holidays: [] };
}

/* --------------------------------- classes -------------------------------- */

function listClasses() {
  const data = store();
  return {
    data: [...data.classes]
      .sort((a, b) => a.grade_level - b.grade_level || a.name.localeCompare(b.name, "km"))
      .map((c) => ({
        ...c,
        homeroom_name: teacherName(c.homeroom_teacher_id),
        student_count: data.students.filter((s) => s.class_id === c.id && s.status === "active").length,
        subject_count: data.classSubjects.filter((cs) => cs.class_id === c.id).length,
        year_name: data.years.find((y) => y.id === c.academic_year_id)?.name ?? null,
      })),
  };
}

function saveClass(body: Record<string, unknown>, id?: number) {
  const data = store();
  const name = String(body.name ?? "").trim();
  const gradeLevel = qNum(body.grade_level);
  const yearId = qNum(body.academic_year_id);
  if (!id) {
    if (!name || !gradeLevel || !yearId) throw new HttpError(400, "សូមបញ្ចូលឈ្មោះថ្នាក់ កម្រិត និងឆ្នាំសិក្សា");
    if (data.classes.some((c) => c.name === name && c.academic_year_id === yearId)) {
      throw new HttpError(409, "ឈ្មោះថ្នាក់នេះមានរួចហើយក្នុងឆ្នាំសិក្សានេះ");
    }
    const row = {
      id: nextId(),
      name,
      grade_level: gradeLevel,
      section: (body.section as string) || null,
      academic_year_id: yearId,
      homeroom_teacher_id: qNum(body.homeroom_teacher_id),
      room: (body.room as string) || null,
      capacity: qNum(body.capacity) ?? 50,
      is_active: 1,
    };
    data.classes.push(row);
    audit("create", "class", row.id, `បង្កើតថ្នាក់ ${name}`);
    commit();
    return { id: row.id };
  }

  const row = data.classes.find((c) => c.id === id);
  if (!row) throw new HttpError(404, "រកមិនឃើញថ្នាក់");
  if (name) row.name = name;
  if (gradeLevel) row.grade_level = gradeLevel;
  row.section = (body.section as string) || null;
  if (yearId) row.academic_year_id = yearId;
  row.homeroom_teacher_id = qNum(body.homeroom_teacher_id);
  row.room = (body.room as string) || null;
  if (qNum(body.capacity)) row.capacity = qNum(body.capacity)!;
  if (body.is_active !== undefined) row.is_active = body.is_active ? 1 : 0;
  audit("update", "class", id, `កែប្រែថ្នាក់ ${row.name}`);
  commit();
  return { ok: true };
}

function deleteClass(id: number) {
  const data = store();
  const used = data.students.filter((s) => s.class_id === id).length;
  if (used > 0) throw new HttpError(400, "មិនអាចលុបថ្នាក់ដែលនៅមានសិស្សបានទេ");
  data.classes = data.classes.filter((c) => c.id !== id);
  data.classSubjects = data.classSubjects.filter((cs) => cs.class_id !== id);
  audit("delete", "class", id, "លុបថ្នាក់");
  commit();
  return { ok: true };
}

function classSubjects(id: number) {
  const data = store();
  return {
    data: data.classSubjects
      .filter((cs) => cs.class_id === id)
      .map((cs) => {
        const subject = data.subjects.find((s) => s.id === cs.subject_id);
        if (!subject) return null;
        return {
          ...subject,
          teacher_id: cs.teacher_id,
          teacher_name: teacherName(cs.teacher_id),
          assignment_id: cs.id,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.name_kh ?? "").localeCompare(b!.name_kh ?? "", "km")),
  };
}

function addClassSubject(classId: number, body: Record<string, unknown>) {
  const data = store();
  const subjectId = qNum(body.subject_id);
  if (!subjectId) throw new HttpError(400, "សូមជ្រើសរើសមុខវិជ្ជា");
  if (data.classSubjects.some((cs) => cs.class_id === classId && cs.subject_id === subjectId)) {
    throw new HttpError(409, "មុខវិជ្ជានេះមានក្នុងថ្នាក់រួចហើយ");
  }
  const row: ClassSubjectRow = {
    id: nextId(),
    class_id: classId,
    subject_id: subjectId,
    teacher_id: qNum(body.teacher_id),
  };
  data.classSubjects.push(row);
  audit("create", "class_subject", classId, "បន្ថែមមុខវិជ្ជាចូលថ្នាក់");
  commit();
  return { ok: true };
}

function updateClassSubject(id: number, body: Record<string, unknown>) {
  const data = store();
  const row = data.classSubjects.find((cs) => cs.id === id);
  if (!row) throw new HttpError(404, "រកមិនឃើញ");
  row.teacher_id = qNum(body.teacher_id);
  audit("update", "class_subject", id, "ផ្លាស់ប្ដូរគ្រូបង្រៀន");
  commit();
  return { ok: true };
}

function removeClassSubject(id: number) {
  const data = store();
  data.classSubjects = data.classSubjects.filter((cs) => cs.id !== id);
  audit("delete", "class_subject", id, "ដកមុខវិជ្ជាចេញពីថ្នាក់");
  commit();
  return { ok: true };
}

/* -------------------------------- subjects -------------------------------- */

function listSubjects() {
  const data = store();
  return {
    data: [...data.subjects]
      .sort((a, b) => a.name_kh.localeCompare(b.name_kh, "km"))
      .map((s) => ({
        ...s,
        class_count: data.classSubjects.filter((cs) => cs.subject_id === s.id).length,
        score_count: data.scores.filter((sc) => sc.subject_id === s.id).length,
      })),
  };
}

function saveSubject(body: Record<string, unknown>, id?: number) {
  const data = store();
  const code = String(body.code ?? "").trim().toUpperCase();
  const nameKh = String(body.name_kh ?? "").trim();
  if (!id) {
    if (!code || !nameKh) throw new HttpError(400, "សូមបញ្ចូលកូដ និងឈ្មោះមុខវិជ្ជា");
    if (data.subjects.some((s) => s.code === code)) {
      throw new HttpError(409, "កូដមុខវិជ្ជានេះមានរួចហើយ");
    }
    const row = {
      id: nextId(),
      code,
      name_kh: nameKh,
      name_en: String(body.name_en ?? "") || nameKh,
      credits: Number(body.credits) || 1,
      color: String(body.color ?? "#4f46e5"),
      is_active: 1,
    };
    data.subjects.push(row);
    audit("create", "subject", row.id, `បង្កើតមុខវិជ្ជា ${nameKh}`);
    commit();
    return { id: row.id };
  }
  const row = data.subjects.find((s) => s.id === id);
  if (!row) throw new HttpError(404, "រកមិនឃើញមុខវិជ្ជា");
  if (code && data.subjects.some((s) => s.code === code && s.id !== id)) {
    throw new HttpError(409, "កូដមុខវិជ្ជានេះមានរួចហើយ");
  }
  if (code) row.code = code;
  if (nameKh) row.name_kh = nameKh;
  if (body.name_en !== undefined) row.name_en = String(body.name_en) || row.name_kh;
  if (body.credits !== undefined) row.credits = Number(body.credits) || 1;
  if (body.color) row.color = String(body.color);
  if (body.is_active !== undefined) row.is_active = body.is_active ? 1 : 0;
  audit("update", "subject", id, `កែប្រែមុខវិជ្ជា ${row.name_kh}`);
  commit();
  return { ok: true };
}

function deleteSubject(id: number) {
  const data = store();
  if (data.scores.some((s) => s.subject_id === id)) {
    throw new HttpError(400, "មិនអាចលុបមុខវិជ្ជាដែលមានពិន្ទុរួចហើយបានទេ");
  }
  data.subjects = data.subjects.filter((s) => s.id !== id);
  data.classSubjects = data.classSubjects.filter((cs) => cs.subject_id !== id);
  audit("delete", "subject", id, "លុបមុខវិជ្ជា");
  commit();
  return { ok: true };
}

/* --------------------------------- teachers -------------------------------- */

function listUsers() {
  const data = store();
  return {
    data: data.teachers
      .map((t) => ({
        id: t.id,
        name: t.name,
        name_en: t.name_en,
        role: "teacher" as const,
        email: t.email,
        phone: t.phone,
        gender: t.gender,
        subject_id: t.subject_id,
        subject_name: data.subjects.find((s) => s.id === t.subject_id)?.name_kh ?? null,
        hire_date: t.hire_date,
        is_active: t.is_active,
        last_login_at: null,
        created_at: null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "km")),
  };
}

function saveUser(body: Record<string, unknown>, id?: number) {
  const data = store();
  const name = String(body.name ?? "").trim();
  if (!name) throw new HttpError(400, "សូមបញ្ចូលឈ្មោះគ្រូ");
  if (!id) {
    const row: TeacherRow = {
      id: nextId(),
      name,
      name_en: (body.name_en as string) || null,
      email: (body.email as string) || null,
      phone: (body.phone as string) || null,
      gender: (body.gender as string) || null,
      subject_id: qNum(body.subject_id),
      hire_date: (body.hire_date as string) || null,
      is_active: body.is_active === false ? 0 : 1,
      note: null,
    };
    data.teachers.push(row);
    audit("create", "user", row.id, `បន្ថែមគ្រូ ${name}`);
    commit();
    return { id: row.id };
  }
  const row = data.teachers.find((t) => t.id === id);
  if (!row) throw new HttpError(404, "រកមិនឃើញគ្រូ");
  row.name = name;
  row.name_en = (body.name_en as string) || null;
  row.email = (body.email as string) || null;
  row.phone = (body.phone as string) || null;
  row.gender = (body.gender as string) || null;
  row.subject_id = qNum(body.subject_id);
  row.hire_date = (body.hire_date as string) || null;
  if (body.is_active !== undefined) row.is_active = body.is_active ? 1 : 0;
  audit("update", "user", id, `កែប្រែគ្រូ ${name}`);
  commit();
  return { ok: true };
}

function deleteUser(id: number) {
  const data = store();
  data.teachers = data.teachers.filter((t) => t.id !== id);
  for (const c of data.classes) if (c.homeroom_teacher_id === id) c.homeroom_teacher_id = null;
  for (const cs of data.classSubjects) if (cs.teacher_id === id) cs.teacher_id = null;
  audit("delete", "user", id, "លុបគ្រូ");
  commit();
  return { ok: true };
}

/* --------------------------------- settings -------------------------------- */

function getSettingsPayload() {
  const data = store();
  return {
    settings: getSettings(),
    gradeScale: getGradeScale(),
    scoreTypes: getScoreTypes(),
    years: [...data.years].sort((a, b) => b.name.localeCompare(a.name)),
    terms: [...data.terms]
      .map((t) => ({ ...t, year_name: data.years.find((y) => y.id === t.academic_year_id)?.name ?? "" }))
      .sort((a, b) => b.year_name.localeCompare(a.year_name) || a.semester - b.semester),
  };
}

function updateSettings(body: Record<string, unknown>) {
  const data = store();
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
    if (body[key] !== undefined) setSetting(key, String(body[key]));
  }
  if (Array.isArray(body.grade_scale)) {
    const scale = (body.grade_scale as GradeInfo[])
      .map((g) => ({ grade: String(g.grade), min: Number(g.min), remark: String(g.remark ?? "") }))
      .sort((a, b) => b.min - a.min);
    setSetting("grade_scale", JSON.stringify(scale));
  }
  if (Array.isArray(body.scoreTypes)) {
    for (const t of body.scoreTypes as { id?: number; weight?: number }[]) {
      const row = data.scoreTypes.find((x) => x.id === Number(t.id));
      if (row && t.weight !== undefined) row.weight = Number(t.weight);
    }
  }
  audit("update", "settings", null, "កែប្រែការកំណត់ប្រព័ន្ធ");
  commit();
  return { ok: true, ...getSettingsPayload() };
}

function createYear(body: Record<string, unknown>) {
  const data = store();
  const name = String(body.name ?? "").trim();
  if (!name) throw new HttpError(400, "សូមបញ្ចូលឈ្មោះឆ្នាំសិក្សា");
  if (data.years.some((y) => y.name === name)) throw new HttpError(409, "ឆ្នាំសិក្សានេះមានរួចហើយ");

  const year = {
    id: nextId(),
    name,
    start_date: (body.start_date as string) || null,
    end_date: (body.end_date as string) || null,
    is_current: data.years.some((y) => y.is_current === 1) ? 0 : 1,
  };
  data.years.push(year);
  const term1 = {
    id: nextId(),
    academic_year_id: year.id,
    name: "ឆមាសទី១",
    semester: 1,
    start_date: year.start_date,
    end_date: null as string | null,
    is_current: 0,
  };
  const term2 = {
    id: nextId(),
    academic_year_id: year.id,
    name: "ឆមាសទី២",
    semester: 2,
    start_date: null as string | null,
    end_date: year.end_date,
    is_current: 0,
  };
  data.terms.push(term1, term2);
  if (!data.terms.some((t) => t.is_current === 1)) term1.is_current = 1;
  audit("create", "academic_year", year.id, `បង្កើតឆ្នាំសិក្សា ${name}`);
  commit();
  return { id: year.id };
}

function updateYear(id: number, body: Record<string, unknown>) {
  const data = store();
  const row = data.years.find((y) => y.id === id);
  if (!row) throw new HttpError(404, "រកមិនឃើញឆ្នាំសិក្សា");
  const name = String(body.name ?? "").trim();
  if (name) row.name = name;
  row.start_date = (body.start_date as string) || null;
  row.end_date = (body.end_date as string) || null;
  if (body.is_current !== undefined) row.is_current = body.is_current ? 1 : 0;
  if (body.is_current) {
    for (const y of data.years) if (y.id !== id) y.is_current = 0;
    const yearTerms = data.terms.filter((t) => t.academic_year_id === id);
    if (!yearTerms.some((t) => t.is_current === 1) && yearTerms.length) {
      for (const t of data.terms) t.is_current = 0;
      yearTerms.sort((a, b) => a.semester - b.semester)[0].is_current = 1;
    }
  }
  audit("update", "academic_year", id, "កែប្រែឆ្នាំសិក្សា");
  commit();
  return { ok: true };
}

function updateTerm(id: number, body: Record<string, unknown>) {
  const data = store();
  const row = data.terms.find((t) => t.id === id);
  if (!row) throw new HttpError(404, "រកមិនឃើញឆមាស");
  const name = String(body.name ?? "").trim();
  if (name) row.name = name;
  row.start_date = (body.start_date as string) || null;
  row.end_date = (body.end_date as string) || null;
  if (body.is_current !== undefined) row.is_current = body.is_current ? 1 : 0;
  if (body.is_current) {
    for (const t of data.terms) if (t.id !== id) t.is_current = 0;
    for (const y of data.years) y.is_current = y.id === row.academic_year_id ? 1 : 0;
  }
  audit("update", "term", id, "កែប្រែឆមាសសិក្សា");
  commit();
  return { ok: true };
}

function addStandardSubjects() {
  const data = store();
  let added = 0;
  for (const s of STANDARD_SUBJECTS) {
    if (data.subjects.some((x) => x.code === s.code)) continue;
    data.subjects.push({ ...s, id: nextId(), is_active: 1 });
    added++;
  }
  audit("create", "subject", null, `បន្ថែមមុខវិជ្ជាស្តង់ដារ ${added}`);
  commit();
  return { ok: true, added };
}

function updateScoreType(id: number, body: Record<string, unknown>) {
  const data = store();
  const row = data.scoreTypes.find((t) => t.id === id);
  if (!row) throw new HttpError(404, "រកមិនឃើញប្រភេទពិន្ទុ");
  if (body.name_kh) row.name_kh = String(body.name_kh);
  if (body.weight !== undefined) row.weight = Number(body.weight);
  audit("update", "score_type", id, "កែប្រែប្រភេទពិន្ទុ");
  commit();
  return { ok: true };
}

function auditList(req: ApiRequest) {
  const data = store();
  const { page, limit, offset } = paginate(req.query, 30);
  const action = req.query.action ?? "";
  const search = (req.query.search ?? "").toLowerCase();
  const rows = [...data.audit]
    .filter((row) => {
      if (action && row.action !== action) return false;
      if (!search) return true;
      return [row.user_name, row.detail, row.entity]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => b.id - a.id);
  return { data: rows.slice(offset, offset + limit), total: rows.length, page, limit };
}

/* -------------------------------- dashboard -------------------------------- */

function dashboard(req: ApiRequest) {
  const data = store();
  const termId = qNum(req.query.term_id) ?? currentTermId();
  const classes = data.classes
    .filter((c) => c.is_active === 1)
    .sort((a, b) => a.grade_level - b.grade_level || a.name.localeCompare(b.name, "km"));

  const counts = {
    students: data.students.filter((s) => s.status === "active").length,
    males: data.students.filter((s) => s.status === "active" && s.gender === "M").length,
    females: data.students.filter((s) => s.status === "active" && s.gender === "F").length,
    classes: classes.length,
    subjects: data.subjects.filter((s) => s.is_active === 1).length,
    teachers: data.teachers.filter((t) => t.is_active === 1).length,
    totalStudents: data.students.length,
  };

  const pass = passMark();
  const perClass = termId ? classes.map((c) => ({ c, res: computeClassResults(c.id, termId) })) : [];

  const classResults = perClass.map(({ c, res }) => {
    const avgs = res.students.map((s) => s.average).filter((a): a is number => a !== null);
    return {
      class_id: c.id,
      name: c.name,
      grade_level: c.grade_level,
      students: res.students.length,
      average: avgs.length ? round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null,
      pass_rate: avgs.length
        ? Math.round((avgs.filter((a) => a >= pass).length / avgs.length) * 1000) / 10
        : null,
      highest: avgs.length ? Math.max(...avgs) : null,
    };
  });

  const gradedStudents = perClass.flatMap((p) => p.res.students);
  const allAverages = gradedStudents.map((s) => s.average).filter((a): a is number => a !== null);
  const overallAverage = allAverages.length
    ? round(allAverages.reduce((a, b) => a + b, 0) / allAverages.length)
    : null;

  const gradeScale = getGradeScale();
  const bands = gradeScale.map((g) => ({ grade: g.grade, label: g.remark, min: g.min, count: 0 }));
  for (const avg of allAverages) {
    const idx = gradeScale.findIndex((g) => avg >= g.min);
    const band = bands[idx === -1 ? bands.length - 1 : idx];
    if (band) band.count++;
  }

  const subjectRows = data.subjects
    .map((s) => {
      const values = data.scores
        .filter((sc) => sc.subject_id === s.id && sc.term_id === (termId ?? 0))
        .map((sc) => sc.score);
      return {
        id: s.id,
        code: s.code,
        name_kh: s.name_kh,
        color: s.color,
        score_count: values.length,
        average: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null,
      };
    })
    .filter((s) => s.score_count > 0)
    .sort((a, b) => a.name_kh.localeCompare(b.name_kh, "km"));

  const termsSorted = [...data.terms].sort(
    (a, b) =>
      (data.years.find((y) => y.id === a.academic_year_id)?.name ?? "").localeCompare(
        data.years.find((y) => y.id === b.academic_year_id)?.name ?? "",
      ) || a.semester - b.semester,
  );
  const trend = termsSorted
    .map((t) => {
      const rows = classes.flatMap((c) => computeClassResults(c.id, t.id).students);
      const avgs = rows.map((s) => s.average).filter((a): a is number => a !== null);
      return {
        term_id: t.id,
        label: t.name,
        year: data.years.find((y) => y.id === t.academic_year_id)?.name ?? "",
        average: avgs.length ? round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null,
      };
    })
    .filter((t) => t.average !== null);

  const topStudents = termId
    ? [...gradedStudents]
        .filter((s) => s.average !== null)
        .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
        .slice(0, 8)
        .map((s, i) => ({ ...s, school_rank: i + 1 }))
    : [];

  const month = todayISO().slice(0, 7);
  const monthRows = data.attendance.filter((a) => a.date.startsWith(`${month}-`));
  const attendanceTotal = monthRows.length;
  const attendanceRate = attendanceTotal
    ? Math.round(
        (monthRows.filter((a) => a.status === "present" || a.status === "late").length /
          attendanceTotal) *
          1000,
      ) / 10
    : null;

  const recentScores = [...data.scores]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 6)
    .map((sc) => {
      const student = data.students.find((s) => s.id === sc.student_id);
      const cls = data.classes.find((c) => c.id === student?.class_id);
      const subject = data.subjects.find((s) => s.id === sc.subject_id);
      const type = data.scoreTypes.find((t) => t.id === sc.score_type_id);
      return {
        at: sc.updated_at,
        user_name: "អ្នកប្រើប្រាស់ក្នុងឧបករណ៍",
        subject: subject?.name_kh ?? "",
        class_name: cls?.name ?? "",
        type_name: type?.name_kh ?? "",
        count: 1,
        student_name: student ? nameOf(student) : "",
        score: sc.score,
      };
    });

  const recentLogs = [...data.audit].sort((a, b) => b.id - a.id).slice(0, 8);

  const attention = gradedStudents
    .filter((s) => s.average !== null && s.average < pass)
    .sort((a, b) => (a.average ?? 0) - (b.average ?? 0))
    .slice(0, 6);

  return {
    counts,
    overallAverage,
    passRate: allAverages.length
      ? Math.round((allAverages.filter((a) => a >= pass).length / allAverages.length) * 1000) / 10
      : null,
    bands,
    subjectPerformance: subjectRows,
    classResults,
    trend,
    topStudents,
    attendance: {
      rate: attendanceRate,
      present: monthRows.filter((a) => a.status === "present").length,
      absent: monthRows.filter((a) => a.status === "absent").length,
      late: monthRows.filter((a) => a.status === "late").length,
      permission: monthRows.filter((a) => a.status === "permission").length,
      total: attendanceTotal,
    },
    recentScores,
    recentLogs,
    attention,
    termId,
    term: termId ? data.terms.find((t) => t.id === termId) ?? null : null,
    month,
  };
}

/* -------------------------------- CSV export ------------------------------- */

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  const head = headers.map((h) => csvEscape(h.label)).join(",");
  const body = rows.map((row) => headers.map((h) => csvEscape(row[h.key])).join(",")).join("\r\n");
  return `\uFEFF${head}\r\n${body}`;
}

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export function csvFor(path: string, query: Record<string, string>): { csv: string; filename: string } {
  const data = store();
  const classId = qNum(query.class_id);

  if (path.startsWith("/students/import/template")) {
    const csv = toCsv(
      [
        { key: "code", label: "កូដសិស្ស" },
        { key: "last_name_kh", label: "នាមត្រកូល" },
        { key: "first_name_kh", label: "នាមខ្លួន" },
        { key: "gender", label: "ភេទ (M/F)" },
        { key: "dob", label: "ថ្ងៃខែឆ្នាំកំណើត (YYYY-MM-DD)" },
        { key: "class_name", label: "ថ្នាក់" },
        { key: "phone", label: "លេខទូរស័ព្ទ" },
        { key: "guardian_name", label: "អ្នកអភិបាល" },
        { key: "guardian_phone", label: "ទូរស័ព្ទអ្នកអភិបាល" },
        { key: "address", label: "អាសយដ្ឋាន" },
      ],
      [
        {
          code: "STU-9001",
          last_name_kh: "សុខ",
          first_name_kh: "ដារា",
          gender: "M",
          dob: "2011-05-12",
          class_name: "7A",
          phone: "012345678",
          guardian_name: "សុខ វិចិត្រ",
          guardian_phone: "098765432",
          address: "សៀមរាប",
        },
      ],
    );
    return { csv, filename: "student-import-template.csv" };
  }

  if (path.startsWith("/students/export")) {
    const rows = data.students
      .filter((s) => !classId || s.class_id === classId)
      .map((s) => ({
        ...s,
        class_name: data.classes.find((c) => c.id === s.class_id)?.name ?? "",
        name_kh: nameOf(s),
      }));
    const csv = toCsv(
      [
        { key: "code", label: "កូដសិស្ស" },
        { key: "last_name_kh", label: "នាមត្រកូល" },
        { key: "first_name_kh", label: "នាមខ្លួន" },
        { key: "gender", label: "ភេទ" },
        { key: "dob", label: "ថ្ងៃខែឆ្នាំកំណើត" },
        { key: "class_name", label: "ថ្នាក់" },
        { key: "phone", label: "លេខទូរស័ព្ទ" },
        { key: "guardian_name", label: "អ្នកអភិបាល" },
        { key: "guardian_phone", label: "ទូរស័ព្ទអ្នកអភិបាល" },
        { key: "address", label: "អាសយដ្ឋាន" },
        { key: "status", label: "ស្ថានភាព" },
      ],
      rows,
    );
    return { csv, filename: `students-${todayISO()}.csv` };
  }

  if (path.startsWith("/results/export")) {
    const termId = qNum(query.term_id) ?? currentTermId();
    if (!classId || !termId) throw new HttpError(400, "សូមជ្រើសរើសថ្នាក់ និងឆមាស");
    const result = computeClassResults(classId, termId);
    const cls = data.classes.find((c) => c.id === classId);
    const rows = result.students.map((s) => {
      const row: Record<string, unknown> = {
        rank: s.rank ?? "",
        code: s.code,
        name: s.name_kh,
        gender: s.gender === "M" ? "ប្រុស" : "ស្រី",
        total: s.total ?? "",
        average: s.average ?? "",
        grade: s.grade ?? "",
        remark: s.remark ?? "",
      };
      for (const sub of result.subjects) {
        const found = s.subjects.find((x) => x.subject_id === sub.id);
        row[sub.code] = found?.average ?? "";
      }
      return row;
    });
    const headers = [
      { key: "rank", label: "ចំណាត់ថ្នាក់" },
      { key: "code", label: "កូដសិស្ស" },
      { key: "name", label: "ឈ្មោះសិស្ស" },
      { key: "gender", label: "ភេទ" },
      ...result.subjects.map((s) => ({ key: s.code, label: s.name_kh })),
      { key: "total", label: "សរុប" },
      { key: "average", label: "មធ្យមភាគ" },
      { key: "grade", label: "និទ្ទេស" },
      { key: "remark", label: "ការវាយតម្លៃ" },
    ];
    return {
      csv: toCsv(headers, rows),
      filename: `results-${cls?.name ?? classId}-${termId}.csv`,
    };
  }

  if (path.startsWith("/attendance/export")) {
    const month = query.month || todayISO().slice(0, 7);
    if (!classId) throw new HttpError(400, "សុំជ្រើសរើសថ្នាក់");
    const rows = data.students
      .filter((s) => s.class_id === classId && s.status === "active")
      .map((s) => {
        const mine = data.attendance.filter(
          (a) => a.student_id === s.id && a.date.startsWith(`${month}-`),
        );
        return {
          code: s.code,
          name: nameOf(s),
          present: mine.filter((a) => a.status === "present").length,
          absent: mine.filter((a) => a.status === "absent").length,
          late: mine.filter((a) => a.status === "late").length,
          permission: mine.filter((a) => a.status === "permission").length,
        };
      });
    return {
      csv: toCsv(
        [
          { key: "code", label: "កូដសិស្ស" },
          { key: "name", label: "ឈ្មោះ" },
          { key: "present", label: "វត្តមាន" },
          { key: "absent", label: "អវត្តមាន" },
          { key: "late", label: "មកយឺត" },
          { key: "permission", label: "សុំច្បាប់" },
        ],
        rows,
      ),
      filename: `attendance-${month}.csv`,
    };
  }

  throw new HttpError(404, "រកមិនឃើញឯកសារនាំចេញ");
}

/* ------------------------------- dispatch ---------------------------------- */

export function handleLocal(req: ApiRequest): unknown {
  const { method, path, query, body } = req;
  const p = path.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
  const seg = p.split("/").filter(Boolean);
  const id = seg.length ? Number(seg[seg.length - 1]) : NaN;

  if (method === "GET" && p === "/meta") return meta(req);
  if (method === "GET" && p === "/dashboard") return dashboard(req);

  if (method === "GET" && p === "/auth/users") return listUsers();
  if (method === "GET" && p === "/auth/me") {
    return { user: { id: 0, name: "អ្នកប្រើប្រាស់ក្នុងឧបករណ៍", role: "admin", email: null } };
  }

  if (method === "GET" && p === "/students") return listStudents(req);
  if (method === "POST" && p === "/students") return createStudent(body);
  if (method === "POST" && p === "/students/bulk/transfer") return transferStudents(body);
  if (method === "POST" && p === "/students/import") return importStudents(body);
  if (method === "GET" && /^\/students\/\d+$/.test(p)) return getStudent(req, id);
  if (method === "PUT" && /^\/students\/\d+$/.test(p)) return updateStudent(id, body);
  if (method === "DELETE" && /^\/students\/\d+$/.test(p)) return deleteStudent(id);

  if (method === "GET" && p === "/classes") return listClasses();
  if (method === "POST" && p === "/classes") return saveClass(body);
  if (method === "GET" && /^\/classes\/\d+\/subjects$/.test(p)) return classSubjects(id);
  if (method === "POST" && /^\/classes\/\d+\/subjects$/.test(p)) return addClassSubject(Number(seg[1]), body);
  if (method === "PUT" && /^\/classes\/\d+$/.test(p)) return saveClass(body, id);
  if (method === "DELETE" && /^\/classes\/\d+$/.test(p)) return deleteClass(id);
  if (method === "PUT" && /^\/class-subjects\/\d+$/.test(p)) return updateClassSubject(id, body);
  if (method === "DELETE" && /^\/class-subjects\/\d+$/.test(p)) return removeClassSubject(id);

  if (method === "GET" && p === "/subjects") return listSubjects();
  if (method === "POST" && p === "/subjects") return saveSubject(body);
  if (method === "PUT" && /^\/subjects\/\d+$/.test(p)) return saveSubject(body, id);
  if (method === "DELETE" && /^\/subjects\/\d+$/.test(p)) return deleteSubject(id);

  if (method === "GET" && p === "/scores") return scoreGrid(req);
  if (method === "PUT" && p === "/scores/bulk") return saveScores(body);
  if (method === "GET" && p === "/scores/my-assignments") return myAssignments();
  if (method === "GET" && /^\/scores\/student\/\d+$/.test(p)) return studentScores(id);

  if (method === "GET" && p === "/results/class") return classResults(req);
  if (method === "GET" && p === "/results/ranking") return ranking(req);
  if (method === "GET" && /^\/results\/student\/\d+$/.test(p)) return studentReport(req, id);
  if (method === "GET" && /^\/results\/transcript\/\d+$/.test(p)) return transcript(id);

  if (method === "GET" && p === "/attendance") return attendanceDay(req);
  if (method === "GET" && p === "/attendance/monthly") return attendanceMonthly(req);
  if (method === "PUT" && p === "/attendance/bulk") return saveAttendance(body);

  if (method === "GET" && p === "/admin/settings") return getSettingsPayload();
  if (method === "PUT" && p === "/admin/settings") return updateSettings(body);
  if (method === "POST" && p === "/admin/years") return createYear(body);
  if (method === "PUT" && /^\/admin\/years\/\d+$/.test(p)) return updateYear(id, body);
  if (method === "PUT" && /^\/admin\/terms\/\d+$/.test(p)) return updateTerm(id, body);
  if (method === "POST" && p === "/admin/standard-subjects") return addStandardSubjects();
  if (method === "GET" && p === "/admin/score-types") return { data: getScoreTypes() };
  if (method === "PUT" && /^\/admin\/score-types\/\d+$/.test(p)) return updateScoreType(id, body);
  if (method === "GET" && p === "/admin/audit") return auditList(req);
  if (method === "GET" && p === "/admin/users") return listUsers();
  if (method === "POST" && p === "/admin/users") return saveUser(body);
  if (method === "PUT" && /^\/admin\/users\/\d+$/.test(p)) return saveUser(body, id);
  if (method === "DELETE" && /^\/admin\/users\/\d+$/.test(p)) return deleteUser(id);

  throw new HttpError(404, "រកមិនឃើញចំណុចបញ្ជា (API endpoint) នេះ");
}

/* ------------------------------ CSV import -------------------------------- */

function importStudents(body: Record<string, unknown>) {
  const data = store();
  const csv = String(body.csv ?? "");
  if (!csv.trim()) throw new HttpError(400, "ឯកសារ CSV ទទេ");
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new HttpError(400, "ឯកសារ CSV គ្មានទិន្នន័យ");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iCode = idx("កូដសិស្ស", "code");
  const iLast = idx("នាមត្រកូល", "last_name", "last_name_kh");
  const iFirst = idx("នាមខ្លួន", "first_name", "first_name_kh");
  const iGender = idx("ភេទ (m/f)", "ភេទ", "gender");
  const iDob = idx("ថ្ងៃខែឆ្នាំកំណើត (yyyy-mm-dd)", "dob");
  const iClass = idx("ថ្នាក់", "class", "class_name");
  const iPhone = idx("លេខទូរស័ព្ទ", "phone");
  const iGuardian = idx("អ្នកអភិបាល", "guardian_name");
  const iGuardianPhone = idx("ទូរស័ព្ទអ្នកអភិបាល", "guardian_phone");
  const iAddress = idx("អាសយដ្ឋាន", "address");
  if (iLast < 0 || iFirst < 0) throw new HttpError(400, "ខ្វះជួរឈរ នាមត្រកូល ឬ នាមខ្លួន");

  let created = 0;
  const errors: string[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const last = (row[iLast] ?? "").trim();
    const first = (row[iFirst] ?? "").trim();
    if (!last || !first) {
      errors.push(`ជួរទី ${r + 1}: ខ្វះឈ្មោះ`);
      continue;
    }
    const genderRaw = (iGender >= 0 ? row[iGender] : "M").trim().toUpperCase();
    const gender: "M" | "F" = ["F", "FEMALE", "ស្រី"].includes(genderRaw) ? "F" : "M";
    const classRaw = (iClass >= 0 ? row[iClass] : "").trim();
    let classId: number | null = null;
    if (classRaw) {
      const cls = data.classes.find((c) => c.name.toLowerCase() === classRaw.toLowerCase());
      if (!cls) {
        errors.push(`ជួរទី ${r + 1}: រកមិនឃើញថ្នាក់ "${classRaw}"`);
        continue;
      }
      classId = cls.id;
    }
    const code = (iCode >= 0 ? row[iCode] : "").trim() || nextStudentCode();
    if (data.students.some((s) => s.code === code)) {
      errors.push(`ជួរទី ${r + 1}: កូដសិស្សស្ទួន`);
      continue;
    }
    data.students.push({
      id: nextId(),
      code,
      last_name_kh: last,
      first_name_kh: first,
      last_name_en: null,
      first_name_en: null,
      gender,
      dob: (iDob >= 0 ? row[iDob] : "")?.trim() || null,
      class_id: classId,
      phone: (iPhone >= 0 ? row[iPhone] : "")?.trim() || null,
      guardian_name: (iGuardian >= 0 ? row[iGuardian] : "")?.trim() || null,
      guardian_phone: (iGuardianPhone >= 0 ? row[iGuardianPhone] : "")?.trim() || null,
      address: (iAddress >= 0 ? row[iAddress] : "")?.trim() || null,
      enroll_date: todayISO(),
      status: "active",
      note: null,
      created_at: timestamp(),
    });
    created++;
  }
  audit("import", "student", null, `នាំចូលសិស្ស ${created} នាក់`);
  commit();
  return { created, errors: errors.slice(0, 20), totalErrors: errors.length };
}
