import { Router } from "express";
import { db, audit } from "../db.js";
import { authRequired, canEditClass } from "../auth.js";
import { HttpError, asyncHandler, todayISO, toCsv } from "../util.js";

const router = Router();
router.use(authRequired);

const STATUSES = ["present", "absent", "late", "permission"] as const;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const classId = Number(req.query.class_id);
    const date = String(req.query.date ?? todayISO());
    if (!classId) throw new HttpError(400, "សូមជ្រើសរើសថ្នាក់");
    const students = db
      .prepare(
        `SELECT id, code, last_name_kh, first_name_kh, gender,
                (last_name_kh || ' ' || first_name_kh) AS name_kh
           FROM students WHERE class_id = ? AND status = 'active'
          ORDER BY last_name_kh, first_name_kh`,
      )
      .all(classId) as any[];
    const records = db
      .prepare("SELECT student_id, status, note FROM attendance WHERE class_id = ? AND date = ?")
      .all(classId, date) as any[];
    const map: Record<number, { status: string; note: string | null }> = {};
    for (const r of records) map[r.student_id] = { status: r.status, note: r.note };
    res.json({
      students,
      date,
      classId,
      records: map,
      canEdit: canEditClass(classId, req.user!),
      marked: records.length,
    });
  }),
);

router.put(
  "/bulk",
  asyncHandler(async (req, res) => {
    const classId = Number(req.body?.class_id);
    const date = String(req.body?.date ?? todayISO());
    const entries = req.body?.entries;
    if (!classId || !Array.isArray(entries)) throw new HttpError(400, "ព័ត៌មានមិនគ្រប់គ្រាន់");
    if (!canEditClass(classId, req.user!)) throw new HttpError(403, "អ្នកគ្មានសិទ្ធិកត់ត្រាវត្តមានថ្នាក់នេះទេ");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "កាលបរិច្ឆេទមិនត្រឹមត្រូវ");

    const validStudents = new Set(
      (db.prepare("SELECT id FROM students WHERE class_id = ?").all(classId) as any[]).map((r) => r.id),
    );
    const upsert = db.prepare(
      `INSERT INTO attendance (student_id, class_id, date, status, note, recorded_by, updated_at)
       VALUES (?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(student_id, date) DO UPDATE SET
         status = excluded.status, note = excluded.note,
         recorded_by = excluded.recorded_by, updated_at = datetime('now')`,
    );
    let saved = 0;
    db.exec("BEGIN");
    try {
      for (const e of entries) {
        const studentId = Number(e.student_id);
        if (!validStudents.has(studentId)) throw new HttpError(400, "សិស្សមិនស្ថិតក្នុងថ្នាក់នេះ");
        if (!STATUSES.includes(e.status)) throw new HttpError(400, "ស្ថានភាពវត្តមានមិនត្រឹមត្រូវ");
        upsert.run(studentId, classId, date, e.status, e.note ?? null, req.user!.id);
        saved++;
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    const cls = db.prepare("SELECT name FROM classes WHERE id = ?").get(classId) as any;
    audit(req.user, "update", "attendance", classId, `កត់ត្រាវត្តមាន ${cls?.name ?? ""} ថ្ងៃ ${date}`, req.ip);
    res.json({ ok: true, saved });
  }),
);

router.get(
  "/monthly",
  asyncHandler(async (req, res) => {
    const classId = Number(req.query.class_id);
    const month = String(req.query.month ?? todayISO().slice(0, 7));
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
    const students = db
      .prepare(
        `SELECT id, code, last_name_kh, first_name_kh, gender,
                (last_name_kh || ' ' || first_name_kh) AS name_kh
           FROM students WHERE class_id = ? AND status = 'active'
          ORDER BY last_name_kh, first_name_kh`,
      )
      .all(classId) as any[];
    const records = db
      .prepare(
        "SELECT student_id, date, status, note FROM attendance WHERE class_id = ? AND date LIKE ?",
      )
      .all(classId, `${month}-%`) as any[];
    const byStudent = new Map<number, Record<string, string>>();
    for (const r of records) {
      const map = byStudent.get(r.student_id) ?? {};
      map[r.date] = r.status;
      byStudent.set(r.student_id, map);
    }
    const rows = students.map((s) => {
      const rec = byStudent.get(s.id) ?? {};
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
    res.json({ days, month, students: rows, holidays: [] });
  }),
);

router.get(
  "/export/csv",
  asyncHandler(async (req, res) => {
    const classId = Number(req.query.class_id);
    const month = String(req.query.month ?? todayISO().slice(0, 7));
    if (!classId) throw new HttpError(400, "សូមជ្រើសរើសថ្នាក់");
    const students = db
      .prepare(
        `SELECT id, code, (last_name_kh || ' ' || first_name_kh) AS name_kh
           FROM students WHERE class_id = ? AND status='active' ORDER BY last_name_kh`,
      )
      .all(classId) as any[];
    const rows = db
      .prepare(
        `SELECT student_id,
                SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) present,
                SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) absent,
                SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) late,
                SUM(CASE WHEN status='permission' THEN 1 ELSE 0 END) permission
           FROM attendance WHERE class_id = ? AND date LIKE ? GROUP BY student_id`,
      )
      .all(classId, `${month}-%`) as any[];
    const map = new Map(rows.map((r) => [r.student_id, r]));
    const out = students.map((s) => ({
      code: s.code,
      name: s.name_kh,
      present: map.get(s.id)?.present ?? 0,
      absent: map.get(s.id)?.absent ?? 0,
      late: map.get(s.id)?.late ?? 0,
      permission: map.get(s.id)?.permission ?? 0,
    }));
    const csv = toCsv(
      [
        { key: "code", label: "កូដសិស្ស" },
        { key: "name", label: "ឈ្មោះ" },
        { key: "present", label: "វត្តមាន" },
        { key: "absent", label: "អវត្តមាន" },
        { key: "late", label: "មកយឺត" },
        { key: "permission", label: "សុំច្បាប់" },
      ],
      out,
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${month}.csv"`);
    res.send(csv);
  }),
);

export default router;
