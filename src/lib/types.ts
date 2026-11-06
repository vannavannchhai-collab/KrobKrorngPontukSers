export type Role = "admin" | "teacher";

export interface User {
  id: number;
  username?: string;
  name: string;
  name_en?: string | null;
  role: Role;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  subject_id?: number | null;
  subject_name?: string | null;
  hire_date?: string | null;
  is_active?: number;
  last_login_at?: string | null;
  created_at?: string;
}

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
  year_name?: string;
}

export interface Subject {
  id: number;
  code: string;
  name_kh: string;
  name_en: string;
  credits: number;
  color: string;
  is_active: number;
  class_count?: number;
  score_count?: number;
  teacher_id?: number | null;
  teacher_name?: string | null;
  assignment_id?: number;
}

export interface ClassRoom {
  id: number;
  name: string;
  grade_level: number;
  section: string | null;
  academic_year_id: number;
  homeroom_teacher_id: number | null;
  homeroom_name: string | null;
  room: string | null;
  capacity: number;
  is_active: number;
  student_count?: number;
  subject_count?: number;
  year_name?: string;
}

export interface Student {
  id: number;
  code: string;
  last_name_kh: string;
  first_name_kh: string;
  last_name_en: string | null;
  first_name_en: string | null;
  name_kh: string;
  gender: "M" | "F";
  dob: string | null;
  class_id: number | null;
  class_name: string | null;
  grade_level: number | null;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  address: string | null;
  enroll_date: string | null;
  status: "active" | "inactive" | "graduated" | "transferred";
  note: string | null;
  created_at?: string;
  average?: number | null;
  rank?: number | null;
  grade?: string | null;
}

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
  school_rank?: number;
  rank_in_class?: number | null;
}

export interface SettingsSummary {
  school_name: string;
  school_name_en: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  director_name: string;
  motto: string;
  pass_mark: number;
  max_score: number;
  attendance_absent_limit: number;
  locale: string;
  academic_year_id: number | null;
  term_id: number | null;
}

export interface Assignment {
  id: number;
  class_id: number;
  subject_id: number;
  teacher_id: number | null;
  teacher_name: string | null;
}

export interface Meta {
  years: AcademicYear[];
  terms: Term[];
  classes: ClassRoom[];
  subjects: Subject[];
  teachers: Pick<User, "id" | "name" | "name_en" | "role" | "is_active" | "subject_id">[];
  assignments: Assignment[];
  scoreTypes: ScoreType[];
  gradeScale: GradeInfo[];
  settings: SettingsSummary;
}

export interface ClassResultResponse {
  students: StudentResult[];
  subjects: { id: number; code: string; name_kh: string; name_en: string; credits: number }[];
  scoreTypes: ScoreType[];
  subjectAverages: { subject_id: number; code: string; name: string; average: number | null }[];
  class: ClassRoom;
  term: Term;
  homeroom: string | null;
  passMark: number;
  gradeScale: GradeInfo[];
  stats: {
    count: number;
    graded: number;
    average: number | null;
    highest: number | null;
    lowest: number | null;
    passed: number;
    failed: number;
    passRate: number | null;
    males: number;
    females: number;
  };
}

export interface AttendanceRecord {
  status: "present" | "absent" | "late" | "permission";
  note: string | null;
}

export interface AttendanceResponse {
  students: (Pick<Student, "id" | "code" | "name_kh" | "gender" | "last_name_kh" | "first_name_kh">)[];
  date: string;
  classId: number;
  records: Record<number, AttendanceRecord>;
  canEdit: boolean;
  marked: number;
}
