/**
 * Local data store — everything lives in the browser (localStorage).
 *
 * There is no server and no database: the whole application is a static site.
 * Data is kept as one JSON document under `kps.data.v1` and saved whenever a
 * mutation happens, so a refresh keeps all students/scores/attendance.
 */

const STORAGE_KEY = "kps.data.v1";

export interface AcademicYear {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: number;
}

export interface Term {
  id: number;
  academic_year_id: number;
  name: string;
  semester: number;
  start_date: string | null;
  end_date: string | null;
  is_current: number;
}

export interface Klass {
  id: number;
  name: string;
  grade_level: number;
  section: string | null;
  academic_year_id: number;
  homeroom_teacher_id: number | null;
  room: string | null;
  capacity: number;
  is_active: number;
}

export interface SubjectRow {
  id: number;
  code: string;
  name_kh: string;
  name_en: string;
  credits: number;
  color: string;
  is_active: number;
}

export interface TeacherRow {
  id: number;
  name: string;
  name_en: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  subject_id: number | null;
  hire_date: string | null;
  is_active: number;
  note: string | null;
}

export interface ClassSubjectRow {
  id: number;
  class_id: number;
  subject_id: number;
  teacher_id: number | null;
}

export interface StudentRow {
  id: number;
  code: string;
  last_name_kh: string;
  first_name_kh: string;
  last_name_en: string | null;
  first_name_en: string | null;
  gender: "M" | "F";
  dob: string | null;
  class_id: number | null;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  address: string | null;
  enroll_date: string | null;
  status: "active" | "inactive" | "graduated" | "transferred";
  note: string | null;
  created_at: string;
}

export interface ScoreRow {
  id: number;
  student_id: number;
  subject_id: number;
  term_id: number;
  score_type_id: number;
  score: number;
  updated_at: string;
}

export interface AttendanceRow {
  id: number;
  student_id: number;
  class_id: number;
  date: string;
  status: "present" | "absent" | "late" | "permission";
  note: string | null;
  updated_at: string;
}

export interface ScoreTypeRow {
  id: number;
  code: string;
  name_kh: string;
  name_en: string;
  weight: number;
  sort: number;
}

export interface AuditRow {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity: string | null;
  entity_id: number | null;
  detail: string | null;
  ip: string | null;
  created_at: string;
}

export interface DataShape {
  version: number;
  seq: number;
  settings: Record<string, string>;
  years: AcademicYear[];
  terms: Term[];
  classes: Klass[];
  subjects: SubjectRow[];
  teachers: TeacherRow[];
  classSubjects: ClassSubjectRow[];
  students: StudentRow[];
  scores: ScoreRow[];
  attendance: AttendanceRow[];
  scoreTypes: ScoreTypeRow[];
  audit: AuditRow[];
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

/** Default assessment types — system configuration, not demo data. */
const DEFAULT_SCORE_TYPES: Omit<ScoreTypeRow, "id">[] = [
  { code: "quiz", name_kh: "ការងារផ្ទះ/តេស្តខ្លី", name_en: "Assignment", weight: 10, sort: 1 },
  { code: "monthly", name_kh: "ពិន្ទុប្រចាំខែ", name_en: "Monthly Test", weight: 20, sort: 2 },
  { code: "midterm", name_kh: "ពិន្ទុពាក់កណ្ដាលឆមាស", name_en: "Midterm", weight: 30, sort: 3 },
  { code: "final", name_kh: "ពិន្ទុបញ្ចប់ឆមាស", name_en: "Final Exam", weight: 40, sort: 4 },
];

/** Cambodian secondary-school curriculum — starter configuration. */
export const STANDARD_SUBJECTS: Omit<SubjectRow, "id" | "is_active">[] = [
  { code: "KHM", name_kh: "ខ្មែរអក្សរ", name_en: "Khmer Literature", credits: 2, color: "#ef4444" },
  { code: "MATH", name_kh: "គណិតវិទ្យា", name_en: "Mathematics", credits: 2, color: "#3b82f6" },
  { code: "PHY", name_kh: "រូបវិទ្យា", name_en: "Physics", credits: 1.5, color: "#8b5cf6" },
  { code: "CHEM", name_kh: "គីមីវិទ្យា", name_en: "Chemistry", credits: 1.5, color: "#14b8a6" },
  { code: "BIO", name_kh: "ជីវវិទ្យា", name_en: "Biology", credits: 1.5, color: "#22c55e" },
  { code: "EARTH", name_kh: "ផែនដីវិទ្យា", name_en: "Earth Science", credits: 1, color: "#a16207" },
  { code: "HIST", name_kh: "ប្រវត្តិវិទ្យា", name_en: "History", credits: 1, color: "#f59e0b" },
  { code: "GEO", name_kh: "ភូមិវិទ្យា", name_en: "Geography", credits: 1, color: "#0ea5e9" },
  { code: "CIVIC", name_kh: "សីលធម៌-ពលរដ្ឋវិទ្យា", name_en: "Moral & Civics", credits: 1, color: "#f97316" },
  { code: "ENG", name_kh: "ភាសាអង់គ្លេស", name_en: "English", credits: 1.5, color: "#6366f1" },
  { code: "ICT", name_kh: "ព័ត៌មានវិទ្យា", name_en: "Information Technology", credits: 1, color: "#06b6d4" },
  { code: "PE", name_kh: "អប់រំកាយ", name_en: "Physical Education", credits: 1, color: "#84cc16" },
];

function nowISO(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function seed(): DataShape {
  const data: DataShape = {
    version: 1,
    seq: 0,
    settings: { ...DEFAULT_SETTINGS },
    years: [],
    terms: [],
    classes: [],
    subjects: [],
    teachers: [],
    classSubjects: [],
    students: [],
    scores: [],
    attendance: [],
    scoreTypes: [],
    audit: [],
  };

  data.scoreTypes = DEFAULT_SCORE_TYPES.map((t, i) => ({ ...t, id: i + 1 }));
  data.subjects = STANDARD_SUBJECTS.map((s, i) => ({ ...s, id: i + 1, is_active: 1 }));
  data.seq = Math.max(data.scoreTypes.length, data.subjects.length);

  const year: AcademicYear = {
    id: ++data.seq,
    name: "2026-2027",
    start_date: "2026-10-01",
    end_date: "2027-07-31",
    is_current: 1,
  };
  data.years.push(year);
  data.terms.push(
    {
      id: ++data.seq,
      academic_year_id: year.id,
      name: "ឆមាសទី១",
      semester: 1,
      start_date: "2026-10-01",
      end_date: "2027-01-31",
      is_current: 1,
    },
    {
      id: ++data.seq,
      academic_year_id: year.id,
      name: "ឆមាសទី២",
      semester: 2,
      start_date: "2027-02-01",
      end_date: "2027-07-31",
      is_current: 0,
    },
  );

  return data;
}

let cache: DataShape | null = null;

function load(): DataShape {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DataShape>;
      if (parsed && parsed.version === 1) {
        cache = {
          ...seed(),
          ...parsed,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        } as DataShape;
        return cache;
      }
    }
  } catch (err) {
    console.warn("ការអានទិន្នន័យក្នុងឧបករណ៍បរាជ័យ — ចាប់ផ្ដើមថ្មី", err);
  }
  cache = seed();
  persist();
  return cache;
}

function persist() {
  if (!cache) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error("រក្សាទុកទិន្នន័យមិនបាន (អង្គចងចាំពេញ?)", err);
    throw new HttpError(
      507,
      "អង្គចងចាំរបស់កម្មវិធីរុករកពេញ — សូមនាំចេញទិន្នន័យ ឬលុបទិន្នន័យចាស់",
    );
  }
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The live data document. Mutations must be followed by `commit()`. */
export function store(): DataShape {
  return load();
}

export function commit() {
  persist();
}

/** Replace the whole document (used by restore/import of a backup). */
export function replaceAll(next: DataShape) {
  cache = next;
  persist();
}

export function resetAll() {
  cache = seed();
  persist();
}

export function nextId(): number {
  const data = load();
  data.seq += 1;
  return data.seq;
}

export function audit(
  action: string,
  entity: string,
  entityId: number | null,
  detail: string,
  userName = "អ្នកប្រើប្រាស់ក្នុងឧបករណ៍",
) {
  const data = load();
  data.audit.push({
    id: nextId(),
    user_id: null,
    user_name: userName,
    action,
    entity,
    entity_id: entityId,
    detail,
    ip: null,
    created_at: nowISO(),
  });
  // keep the local log bounded
  if (data.audit.length > 2000) data.audit = data.audit.slice(-2000);
}

export function timestamp(): string {
  return nowISO();
}

export function exportAll(): string {
  return JSON.stringify(load(), null, 2);
}

export function importAll(raw: string) {
  const parsed = JSON.parse(raw) as DataShape;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.students)) {
    throw new HttpError(400, "ឯកសារបម្រុងនេះមិនត្រឹមត្រូវទេ");
  }
  replaceAll({ ...seed(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) } });
}
