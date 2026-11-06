import { Router } from "express";
import { db, audit } from "../db.js";
import { adminOnly, authRequired } from "../auth.js";
import { HttpError, asyncHandler, pageParams, parseCsv, toCsv } from "../util.js";
import { attendanceSummary, computeClassResults, computeStudentResult, currentTermId } from "../compute.js";

const router = Router();
router.use(authRequired);

function nextCode(): string {
  const row = db.prepare("SELECT MAX(id) AS m FROM students").get() as { m: number | null };
  return `STU-${String((row.m ?? 0) + 1).padStart(4, "0")}`;
}

const STUDENT_SELECT = `
  SELECT s.*, c.name AS class_name, c.grade_level,
         (s.last_name_kh || ' ' || s.first_name_kh) AS name_kh
    FROM students s LEFT JOIN classes c ON c.id = s.class_id`;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pageParams(req, 20);
    const where: string[] = [];
    const params: any[] = [];

    const search = String(req.query.search ?? "").trim();
    if (search) {
      where.push(
        "(s.last_name_kh LIKE ? OR s.first_name_kh LIKE ? OR s.code LIKE ? OR s.last_name_en LIKE ? OR s.first_name_en LIKE ? OR s.phone LIKE ?)",
      );
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }
    if (req.query.class_id) {
      where.push("s.class_id = ?");
      params.push(Number(req.query.class_id));
    }
    if (req.query.gender) {
      where.push("s.gender = ?");
      params.push(String(req.query.gender));
    }
    if (req.query.status) {
      where.push("s.status = ?");
      params.push(String(req.query.status));
    }
    const grade = req.query.grade_level ? Number(req.query.grade_level) : null;
    if (grade) {
      where.push("c.grade_level = ?");
      params.push(grade);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sortMap: Record<string, string> = {
      name: "s.last_name_kh ASC, s.first_name_kh ASC",
      code: "s.code ASC",
      class: "c.grade_level ASC, c.name ASC",
      newest: "s.created_at DESC",
    };
    const orderBy = sortMap[String(req.query.sort ?? "class")] ?? sortMap.class;

    const total = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM students s LEFT JOIN classes c ON c.id = s.class_id ${whereSql}`)
        .get(...params) as { c: number }
    ).c;

    const rows = db
      .prepare(`${STUDENT_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as any[];

    const termId = Number(req.query.term_id) || currentTermId();
    const enriched = rows.map((s) => {
      if (!s.class_id || !termId) return { ...s, average: null, rank: null, grade: null };
      const { students } = computeClassResults(s.class_id, termId);
      const mine = students.find((x) => x.student_id === s.id);
      return { ...s, average: mine?.average ?? null, rank: mine?.rank ?? null, grade: mine?.grade ?? null };
    });

    const summary = db.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN s.gender='M' THEN 1 ELSE 0 END) AS male,
         SUM(CASE WHEN s.gender='F' THEN 1 ELSE 0 END) AS female,
         SUM(CASE WHEN s.status='active' THEN 1 ELSE 0 END) AS active
       FROM students s LEFT JOIN classes c ON c.id = s.class_id ${whereSql}`,
    ).get(...params) as any;

    res.json({ data: enriched, total, page, limit, summary, termId });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const student = db.prepare(`${STUDENT_SELECT} WHERE s.id = ?`).get(id) as any;
    if (!student) throw new HttpError(404, "រកមិនឃើញសិស្ស");

    const termId = Number(req.query.term_id) || currentTermId();
    const result = termId ? computeStudentResult(id, termId) : null;

    const terms = db
      .prepare("SELECT * FROM terms ORDER BY academic_year_id, semester")
      .all() as unknown as { id: number; name: string; semester: number; academic_year_id: number }[];

    const history = terms.map((t) => {
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

    const term = termId
      ? (db.prepare("SELECT * FROM terms WHERE id = ?").get(termId) as any)
      : null;
    const attendance = student.class_id
      ? attendanceSummary(
          student.class_id,
          term?.start_date ?? "0000-01-01",
          term?.end_date ?? "9999-12-31",
        ).find((a) => a.student_id === id)
      : null;

    res.json({
      student,
      result,
      history,
      attendance,
      classSize: student.class_id
        ? (db.prepare("SELECT COUNT(*) AS c FROM students WHERE class_id = ? AND status='active'").get(student.class_id) as any).c
        : 0,
      className: student.class_name,
      homeroom: student.class_id
        ? (db
            .prepare(
              "SELECT u.name FROM classes c JOIN users u ON u.id=c.homeroom_teacher_id WHERE c.id=?",
            )
            .get(student.class_id) as any)?.name ?? null
        : null,
    });
  }),
);

router.post(
  "/",
  adminOnly,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    if (!b.last_name_kh || !b.first_name_kh) throw new HttpError(400, "សូមបញ្ចូលនាមត្រកូល និងនាមខ្លួន");
    if (!["M", "F"].includes(b.gender)) throw new HttpError(400, "សូមជ្រើសរើសភេទ");
    const code = (b.code && String(b.code).trim()) || nextCode();
    try {
      const info = db
        .prepare(
          `INSERT INTO students
            (code, last_name_kh, first_name_kh, last_name_en, first_name_en, gender, dob, class_id,
             phone, guardian_name, guardian_phone, address, enroll_date, status, note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          code,
          b.last_name_kh,
          b.first_name_kh,
          b.last_name_en ?? null,
          b.first_name_en ?? null,
          b.gender,
          b.dob ?? null,
          b.class_id ? Number(b.class_id) : null,
          b.phone ?? null,
          b.guardian_name ?? null,
          b.guardian_phone ?? null,
          b.address ?? null,
          b.enroll_date ?? new Date().toISOString().slice(0, 10),
          b.status ?? "active",
          b.note ?? null,
        );
      audit(
        req.user,
        "create",
        "student",
        Number(info.lastInsertRowid),
        `បន្ថែមសិស្ស ${b.last_name_kh} ${b.first_name_kh}`,
        req.ip,
      );
      res.status(201).json({ id: Number(info.lastInsertRowid), code });
    } catch (e: any) {
      if (String(e.message).includes("UNIQUE")) throw new HttpError(409, "កូដសិស្សនេះមានរួចហើយ");
      throw e;
    }
  }),
);

router.put(
  "/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const exists = db.prepare("SELECT 1 FROM students WHERE id = ?").get(id);
    if (!exists) throw new HttpError(404, "រកមិនឃើញសិស្ស");
    db.prepare(
      `UPDATE students SET
        code = COALESCE(?, code), last_name_kh = COALESCE(?, last_name_kh),
        first_name_kh = COALESCE(?, first_name_kh), last_name_en = ?, first_name_en = ?,
        gender = COALESCE(?, gender), dob = ?, class_id = ?,
        phone = ?, guardian_name = ?, guardian_phone = ?, address = ?,
        enroll_date = ?, status = COALESCE(?, status), note = ?
       WHERE id = ?`,
    ).run(
      b.code ? String(b.code).trim() : null,
      b.last_name_kh ?? null,
      b.first_name_kh ?? null,
      b.last_name_en ?? null,
      b.first_name_en ?? null,
      b.gender ?? null,
      b.dob ?? null,
      b.class_id === undefined || b.class_id === null || b.class_id === "" ? null : Number(b.class_id),
      b.phone ?? null,
      b.guardian_name ?? null,
      b.guardian_phone ?? null,
      b.address ?? null,
      b.enroll_date ?? null,
      b.status ?? null,
      b.note ?? null,
      id,
    );
    audit(req.user, "update", "student", id, `កែប្រែព័ត៌មានសិស្ស ${b.last_name_kh ?? ""}`, req.ip);
    res.json({ ok: true });
  }),
);

router.delete(
  "/:id",
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare("SELECT last_name_kh, first_name_kh FROM students WHERE id = ?").get(id) as any;
    if (!row) throw new HttpError(404, "រកមិនឃើញសិស្ស");
    db.prepare("DELETE FROM students WHERE id = ?").run(id);
    audit(req.user, "delete", "student", id, `លុបសិស្ស ${row.last_name_kh} ${row.first_name_kh}`, req.ip);
    res.json({ ok: true });
  }),
);

/** Move one or many students into another class. */
router.post(
  "/bulk/transfer",
  adminOnly,
  asyncHandler(async (req, res) => {
    const ids: number[] = Array.isArray(req.body?.student_ids) ? req.body.student_ids.map(Number) : [];
    const classId = req.body?.class_id === null ? null : Number(req.body?.class_id);
    if (!ids.length) throw new HttpError(400, "សូមជ្រើសរើសសិស្ស");
    const stmt = db.prepare("UPDATE students SET class_id = ? WHERE id = ?");
    for (const id of ids) stmt.run(classId, id);
    audit(req.user, "update", "student", null, `ផ្ទេរសិស្ស ${ids.length} នាក់ទៅថ្នាក់ថ្មី`, req.ip);
    res.json({ ok: true, moved: ids.length });
  }),
);

/* ------------------------------- CSV import ------------------------------- */

const IMPORT_HEADERS = [
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
];

router.get(
  "/import/template",
  asyncHandler(async (_req, res) => {
    const csv = toCsv(IMPORT_HEADERS, [
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
    ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="student-import-template.csv"');
    res.send(csv);
  }),
);

router.post(
  "/import",
  adminOnly,
  asyncHandler(async (req, res) => {
    const csv = String(req.body?.csv ?? "");
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
    const insert = db.prepare(
      `INSERT INTO students (code, last_name_kh, first_name_kh, gender, dob, class_id, phone,
         guardian_name, guardian_phone, address, enroll_date, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,date('now'),'active')`,
    );
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const last = (row[iLast] ?? "").trim();
      const first = (row[iFirst] ?? "").trim();
      if (!last || !first) {
        errors.push(`ជួរទី ${r + 1}: ខ្វះឈ្មោះ`);
        continue;
      }
      const genderRaw = (iGender >= 0 ? row[iGender] : "M").trim().toUpperCase();
      const gender = ["F", "FEMALE", "ស្រី", " female"].includes(genderRaw) || genderRaw === "F" ? "F" : "M";
      const classRaw = (iClass >= 0 ? row[iClass] : "").trim();
      let classId: number | null = null;
      if (classRaw) {
        const cls = db.prepare("SELECT id FROM classes WHERE lower(name) = lower(?)").get(classRaw) as any;
        if (!cls) {
          errors.push(`ជួរទី ${r + 1}: រកមិនឃើញថ្នាក់ "${classRaw}"`);
          continue;
        }
        classId = cls.id;
      }
      const code = (iCode >= 0 ? row[iCode] : "").trim() || nextCode();
      try {
        insert.run(
          code,
          last,
          first,
          gender,
          (iDob >= 0 ? row[iDob] : "")?.trim() || null,
          classId,
          (iPhone >= 0 ? row[iPhone] : "")?.trim() || null,
          (iGuardian >= 0 ? row[iGuardian] : "")?.trim() || null,
          (iGuardianPhone >= 0 ? row[iGuardianPhone] : "")?.trim() || null,
          (iAddress >= 0 ? row[iAddress] : "")?.trim() || null,
        );
        created++;
      } catch (e: any) {
        errors.push(`ជួរទី ${r + 1}: ${String(e.message).includes("UNIQUE") ? "កូដសិស្សស្ទួន" : "ទិន្នន័យមិនត្រឹមត្រូវ"}`);
      }
    }
    audit(req.user, "import", "student", null, `នាំចូលសិស្ស ${created} នាក់`, req.ip);
    res.json({ created, errors: errors.slice(0, 20), totalErrors: errors.length });
  }),
);

/* -------------------------------- CSV export ------------------------------- */

router.get(
  "/export/csv",
  asyncHandler(async (req, res) => {
    const classId = req.query.class_id ? Number(req.query.class_id) : null;
    const rows = db
      .prepare(
        `${STUDENT_SELECT} ${classId ? "WHERE s.class_id = ?" : ""}
         ORDER BY c.grade_level, c.name, s.last_name_kh, s.first_name_kh`,
      )
      .all(...(classId ? [classId] : [])) as any[];
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
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }),
);

export default router;
