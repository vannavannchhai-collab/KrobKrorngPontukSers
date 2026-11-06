import { db, initSchema } from "./db.js";
import { hashPassword } from "./auth.js";

/* Deterministic PRNG so the demo data set is stable between resets. */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261107);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const SURNAMES = ["សុខ", "ចាន់", "លឹម", "សេង", "ហេង", "ម៉ៅ", "គង់", "អ៊ុក", "ញ៉ែម", "ព្រាប", "ទូច", "ប៊ុន", "យិន", "ស៊ីម", "ខៀវ", "ឡុង", "រស់", "វង្ស", "ភឹម", "តាំង"];
const MALE_NAMES = ["សុភាព", "ដារា", "វិចិត្រ", "សុជាតិ", "រិទ្ធី", "ចំរើន", "សំណាង", "វឌ្ឍនៈ", "ពិសិដ្ឋ", "សុវណ្ណ", "ធារី", "គីរី", "ឧត្តម", "សិលា", "មករា", "ជ័យ", "ណារ៉េត", "ភារុន"];
const FEMALE_NAMES = ["សុជាតា", "ដានី", "ចន្ថា", "សុភា", "រតនា", "ស្រីនី", "ច័ន្ទនី", "ពេជ្រ", "មុនី", "សុគន្ធ", "នារី", "ថានី", "លីដា", "សុខហេង", "បុប្ផា", "កញ្ញា", "វិចិត្រា", "ស្រីមុំ"];
const MALE_EN = ["Sokhapheap", "Dara", "Vichet", "Sojat", "Rithy", "Chamroeun", "Samnang", "Vathana", "Piseth", "Sovann"];
const FEMALE_EN = ["Socheata", "Dany", "Chantha", "Sophea", "Ratana", "Sreyny", "Chantheny", "Pich", "Mony", "Sokunthea"];
const VILLAGES = ["សាលាកំរើក", "វាលពង់", "គោកចក", "ជើងគួន", "ស្វាយដង្គំ", "ព្រះដាក់", "អន្លង់ថ្ម", "គោកដូង"];

const SUBJECTS = [
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

const SCORE_TYPES = [
  { code: "quiz", name_kh: "ការងារផ្ទះ/តេស្តខ្លី", name_en: "Assignment", weight: 10, sort: 1 },
  { code: "monthly", name_kh: "ពិន្ទុប្រចាំខែ", name_en: "Monthly Test", weight: 20, sort: 2 },
  { code: "midterm", name_kh: "ពិន្ទុពាក់កណ្ដាលឆមាស", name_en: "Midterm", weight: 30, sort: 3 },
  { code: "final", name_kh: "ពិន្ទុបញ្ចប់ឆមាស", name_en: "Final Exam", weight: 40, sort: 4 },
];

const TEACHERS = [
  { name: "សុខ សំណាង", name_en: "Sok Samnang", subject: "MATH", gender: "M", role: "admin", username: "admin" },
  { name: "ចាន់ សុភា", name_en: "Chan Sophea", subject: "KHM", gender: "F", role: "teacher", username: "teacher1" },
  { name: "លឹម វិចិត្រ", name_en: "Lim Vichet", subject: "PHY", gender: "M", role: "teacher", username: "teacher2" },
  { name: "សេង ដានី", name_en: "Seng Dany", subject: "CHEM", gender: "F", role: "teacher", username: "teacher3" },
  { name: "ហេង រតនា", name_en: "Heng Ratana", subject: "BIO", gender: "F", role: "teacher", username: "teacher4" },
  { name: "ម៉ៅ សុវណ្ណ", name_en: "Mao Sovann", subject: "ENG", gender: "M", role: "teacher", username: "teacher5" },
  { name: "គង់ មុនី", name_en: "Kong Mony", subject: "ICT", gender: "M", role: "teacher", username: "teacher6" },
  { name: "អ៊ុក នារី", name_en: "Ouk Nary", subject: "HIST", gender: "F", role: "teacher", username: "teacher7" },
  { name: "ញ៉ែម ថានី", name_en: "Nhem Thany", subject: "GEO", gender: "F", role: "teacher", username: "teacher8" },
  { name: "ព្រាប ចំរើន", name_en: "Preap Chamroeun", subject: "CIVIC", gender: "M", role: "teacher", username: "teacher9" },
  { name: "ទូច សុខហេង", name_en: "Touch Sokheng", subject: "EARTH", gender: "M", role: "teacher", username: "teacher10" },
  { name: "ប៊ុន បុប្ផា", name_en: "Bun Bopha", subject: "KHM", gender: "F", role: "teacher", username: "teacher11" },
  { name: "យិន ស្រីនី", name_en: "Yin Sreyny", subject: "MATH", gender: "F", role: "teacher", username: "teacher12" },
  { name: "ខៀវ សុគន្ធ", name_en: "Khiev Sokunthea", subject: "PE", gender: "F", role: "teacher", username: "teacher13" },
];

const CLASSES = [
  { name: "7A", grade: 7, section: "ក", room: "B-101", teacher: "teacher1" },
  { name: "7B", grade: 7, section: "ខ", room: "B-102", teacher: "teacher11" },
  { name: "8A", grade: 8, section: "ក", room: "B-201", teacher: "teacher2" },
  { name: "8B", grade: 8, section: "ខ", room: "B-202", teacher: "teacher5" },
  { name: "9A", grade: 9, section: "ក", room: "B-301", teacher: "teacher3" },
  { name: "9B", grade: 9, section: "ខ", room: "B-302", teacher: "teacher12" },
];

export function seedDatabase(force = false) {
  initSchema();
  const existing = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  if (existing.c > 0 && !force) return false;

  db.exec("BEGIN");
  try {
    if (force) {
      for (const t of ["scores", "attendance", "class_subjects", "students", "classes", "terms", "academic_years", "subjects", "users", "score_types", "audit_logs"]) {
        db.exec(`DELETE FROM ${t};`);
      }
    }

    /* score types */
    const stmtType = db.prepare(
      "INSERT INTO score_types (code, name_kh, name_en, weight, sort) VALUES (?,?,?,?,?)",
    );
    for (const t of SCORE_TYPES) stmtType.run(t.code, t.name_kh, t.name_en, t.weight, t.sort);

    /* academic years + terms */
    const yearStmt = db.prepare(
      "INSERT INTO academic_years (name, start_date, end_date, is_current) VALUES (?,?,?,?)",
    );
    const y1 = Number(yearStmt.run("2025-2026", "2025-10-01", "2026-07-31", 0).lastInsertRowid);
    const y2 = Number(yearStmt.run("2026-2027", "2026-10-01", "2027-07-31", 1).lastInsertRowid);
    const termStmt = db.prepare(
      "INSERT INTO terms (academic_year_id, name, semester, start_date, end_date, is_current) VALUES (?,?,?,?,?,?)",
    );
    const terms = [
      { id: Number(termStmt.run(y1, "ឆមាសទី១", 1, "2025-10-01", "2026-03-15", 0).lastInsertRowid), year: 1 },
      { id: Number(termStmt.run(y1, "ឆមាសទី២", 2, "2026-03-16", "2026-07-31", 0).lastInsertRowid), year: 1 },
      { id: Number(termStmt.run(y2, "ឆមាសទី១", 1, "2026-10-01", "2027-03-15", 1).lastInsertRowid), year: 2 },
      { id: Number(termStmt.run(y2, "ឆមាសទី២", 2, "2027-03-16", "2027-07-31", 0).lastInsertRowid), year: 2 },
    ];

    /* subjects */
    const subjStmt = db.prepare(
      "INSERT INTO subjects (code, name_kh, name_en, credits, color) VALUES (?,?,?,?,?)",
    );
    const subjectIds = new Map<string, number>();
    for (const s of SUBJECTS) {
      subjectIds.set(s.code, Number(subjStmt.run(s.code, s.name_kh, s.name_en, s.credits, s.color).lastInsertRowid));
    }

    /* users */
    const userStmt = db.prepare(
      `INSERT INTO users (username, password_hash, name, name_en, role, email, phone, gender, subject_id, hire_date, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
    );
    const teacherIds = new Map<string, number>();
    TEACHERS.forEach((t, i) => {
      const password = t.role === "admin" ? "admin123" : "123456";
      const id = Number(
        userStmt.run(
          t.username,
          hashPassword(password),
          t.name,
          t.name_en,
          t.role,
          `${t.username}@padhs.edu.kh`,
          `01${randInt(2, 9)} ${randInt(100, 999)} ${randInt(100, 999)}`,
          t.gender,
          subjectIds.get(t.subject) ?? null,
          `20${randInt(10, 22)}-0${randInt(1, 9)}-1${randInt(0, 9)}`,
        ).lastInsertRowid,
      );
      teacherIds.set(t.username, id);
      if (i === 0) teacherIds.set("admin", id);
    });

    /* classes */
    const classStmt = db.prepare(
      `INSERT INTO classes (name, grade_level, section, academic_year_id, homeroom_teacher_id, room, capacity)
       VALUES (?,?,?,?,?,?,?)`,
    );
    const classIds: number[] = [];
    for (const c of CLASSES) {
      const id = Number(
        classStmt.run(c.name, c.grade, c.section, y2, teacherIds.get(c.teacher) ?? null, c.room, 45).lastInsertRowid,
      );
      classIds.push(id);
    }

    /* class-subject assignments */
    const csStmt = db.prepare("INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES (?,?,?)");
    const teacherBySubject = new Map<string, number[]>();
    for (const t of TEACHERS) {
      const list = teacherBySubject.get(t.subject) ?? [];
      list.push(teacherIds.get(t.username)!);
      teacherBySubject.set(t.subject, list);
    }
    for (const classId of classIds) {
      for (const s of SUBJECTS) {
        const candidates = teacherBySubject.get(s.code) ?? [];
        const teacherId = candidates.length ? pick(candidates) : null;
        csStmt.run(classId, subjectIds.get(s.code)!, teacherId);
      }
    }

    /* students */
    const studentStmt = db.prepare(
      `INSERT INTO students (code, last_name_kh, first_name_kh, last_name_en, first_name_en, gender, dob,
        class_id, phone, guardian_name, guardian_phone, address, enroll_date, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'active')`,
    );
    const students: { id: number; classId: number; ability: number }[] = [];
    let counter = 0;
    for (let ci = 0; ci < classIds.length; ci++) {
      const cls = CLASSES[ci];
      const size = randInt(22, 28);
      for (let i = 0; i < size; i++) {
        counter++;
        const gender = rand() < 0.48 ? "M" : "F";
        const last = pick(SURNAMES);
        const first = gender === "M" ? pick(MALE_NAMES) : pick(FEMALE_NAMES);
        const lastEn = pick(["Sok", "Chan", "Lim", "Seng", "Heng", "Mao", "Kong", "Ouk", "Nhem", "Preap", "Touch", "Bun", "Yin", "Sim", "Khiev", "Long"]);
        const firstEn = gender === "M" ? pick(MALE_EN) : pick(FEMALE_EN);
        const birthYear = 2026 - (cls.grade + 6);
        const dob = `${birthYear}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`;
        const guardian = `${last} ${pick(MALE_NAMES)}`;
        const code = `STU-${String(counter).padStart(4, "0")}`;
        const id = Number(
          studentStmt.run(
            code,
            last,
            first,
            lastEn,
            firstEn,
            gender,
            dob,
            classIds[ci],
            `09${randInt(1, 9)} ${randInt(100, 999)} ${randInt(100, 999)}`,
            guardian,
            `01${randInt(2, 9)} ${randInt(100, 999)} ${randInt(100, 999)}`,
            `ភូមិ${pick(VILLAGES)} សង្កាត់សាលាកំរើក ក្រុងសៀមរាប`,
            "2026-10-01",
          ).lastInsertRowid,
        );
        // ability drives the generated score distribution
        const ability = clamp(69 + (rand() + rand() + rand() - 1.5) * 22, 25, 99);
        students.push({ id, classId: classIds[ci], ability });
      }
    }

    /* scores */
    const scoreStmt = db.prepare(
      `INSERT INTO scores (student_id, subject_id, term_id, score_type_id, score, entered_by)
       VALUES (?,?,?,?,?,?)`,
    );
    const typeIdByCode = new Map<string, number>();
    for (const row of db.prepare("SELECT id, code FROM score_types").all() as any[]) {
      typeIdByCode.set(row.code, row.id);
    }
    const subjectToughness = new Map<string, number>([
      ["MATH", -4],
      ["PHY", -6],
      ["CHEM", -5],
      ["EARTH", 3],
      ["PE", 8],
      ["ICT", 4],
      ["KHM", 2],
      ["ENG", -2],
    ]);
    const classTermIndex = new Map<number, number>(); // progress per class-term combo
    let scoreCount = 0;
    for (const term of terms.slice(0, 3)) {
      const isCurrentTerm = term.id === terms[2].id;
      for (const s of students) {
        const drift = term.year === 2 ? 1.5 : 0;
        for (const subject of SUBJECTS) {
          const base =
            s.ability +
            (subjectToughness.get(subject.code) ?? 0) +
            drift +
            (rand() - 0.5) * 12;
          const types = isCurrentTerm ? ["quiz", "monthly", "midterm"] : ["quiz", "monthly", "midterm", "final"];
          for (const type of types) {
            // Some entries are intentionally still missing in the in-progress term.
            if (isCurrentTerm && rand() < (type === "midterm" ? 0.15 : 0.06)) continue;
            if (!isCurrentTerm && rand() < 0.015) continue;
            const offset = type === "final" ? -1 : type === "quiz" ? 3 : 0;
            const score = clamp(Math.round((base + offset + (rand() - 0.5) * 10) * 10) / 10, 12, 100);
            const teacherId = pick(
              teacherBySubject.get(subject.code) ?? [teacherIds.get("admin")!],
            );
            scoreStmt.run(s.id, subjectIds.get(subject.code)!, term.id, typeIdByCode.get(type)!, score, teacherId);
            scoreCount++;
          }
        }
      }
      classTermIndex.set(term.id, scoreCount);
    }

    /* attendance — last 45 weekdays */
    const attStmt = db.prepare(
      "INSERT INTO attendance (student_id, class_id, date, status, note, recorded_by) VALUES (?,?,?,?,?,?)",
    );
    const today = new Date("2026-11-06T00:00:00Z");
    const days: string[] = [];
    for (let d = 0; days.length < 45; d++) {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() - d);
      const dow = date.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      days.push(date.toISOString().slice(0, 10));
    }
    let attCount = 0;
    for (const s of students) {
      for (const day of days) {
        const r = rand();
        const status = r < 0.905 ? "present" : r < 0.945 ? "late" : r < 0.98 ? "absent" : "permission";
        const cls = CLASSES[classIds.indexOf(s.classId)];
        const homeroom = teacherIds.get(cls.teacher) ?? teacherIds.get("admin")!;
        attStmt.run(
          s.id,
          s.classId,
          day,
          status,
          status === "permission" ? "សុំច្បាប់ពីអភិបាល" : status === "absent" ? "គ្មានលិខិត" : null,
          homeroom,
        );
        attCount++;
      }
    }

    /* audit trail samples */
    const auditStmt = db.prepare(
      "INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, detail, ip, created_at) VALUES (?,?,?,?,?,?,?,?)",
    );
    const samples = [
      { user: "សុខ សំណាង", action: "create", entity: "student", detail: "បន្ថែមសិស្សថ្មីចំនួន ៣ នាក់ចូលថ្នាក់ 7A", days: 6 },
      { user: "ចាន់ សុភា", action: "update", entity: "score", detail: "រក្សាទុកពិន្ទុ 26 កំណត់ — 7A / ខ្មែរអក្សរ", days: 5 },
      { user: "លឹម វិចិត្រ", action: "update", entity: "score", detail: "រក្សាទុកពិន្ទុ 24 កំណត់ — 8A / រូបវិទ្យា", days: 4 },
      { user: "សេង ដានី", action: "update", entity: "attendance", detail: "កត់ត្រាវត្តមាន 9A ថ្ងៃ 2026-11-03", days: 3 },
      { user: "សុខ សំណាង", action: "update", entity: "settings", detail: "កែប្រែការកំណត់ប្រព័ន្ធ", days: 2 },
      { user: "ហេង រតនា", action: "create", entity: "class_subject", detail: "បន្ថែមមុខវិជ្ជាចូលថ្នាក់ 8B", days: 1 },
    ];
    for (const s of samples) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - s.days);
      auditStmt.run(
        null,
        s.user,
        s.action,
        s.entity,
        null,
        s.detail,
        "192.168.1.10",
        d.toISOString().slice(0, 19).replace("T", " "),
      );
    }

    db.exec("COMMIT");
    console.log(
      `✅ Seeded ${students.length} students, ${SUBJECTS.length} subjects, ${classIds.length} classes, ${scoreCount} scores, ${attCount} attendance records.`,
    );
    console.log("   អ្នកគ្រប់គ្រង: admin / admin123     គ្រូបង្រៀន: teacher1 … teacher13 / 123456");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return true;
}

/* Allow `npm run seed` to initialise the database directly. */
if (process.argv[1] && /seed\.(ts|js|mts)$/.test(process.argv[1])) {
  initSchema();
  seedDatabase();
  console.log("🌱 ការបង្កើតទិន្នន័យគំរូបានបញ្ចប់។");
}
