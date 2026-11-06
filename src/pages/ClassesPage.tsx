import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CalendarRange,
  Pencil,
  Plus,
  School,
  Trash2,
  UserRound,
  Users,
  Settings2,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import { useAuth } from "../lib/auth";
import type { ClassRoom, Subject } from "../lib/types";
import { ConfirmDialog, EmptyState, Field, Modal, PageLoader, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { cn } from "../lib/utils";

type ClassSubject = Subject & { teacher_id: number | null; teacher_name: string | null; assignment_id: number };

export default function ClassesPage() {
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const qc = useQueryClient();
  const toast = useToast();
  const isAdmin = user?.role === "admin";

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRoom | null>(null);
  const [deleting, setDeleting] = useState<ClassRoom | null>(null);
  const [subjectsFor, setSubjectsFor] = useState<ClassRoom | null>(null);

  const [form, setForm] = useState({
    name: "",
    grade_level: "7",
    section: "",
    academic_year_id: "",
    homeroom_teacher_id: "",
    room: "",
    capacity: "45",
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      grade_level: "7",
      section: "",
      academic_year_id: String(meta?.settings.academic_year_id ?? meta?.years[0]?.id ?? ""),
      homeroom_teacher_id: "",
      room: "",
      capacity: "45",
    });
    setFormOpen(true);
  };

  const openEdit = (c: ClassRoom) => {
    setEditing(c);
    setForm({
      name: c.name,
      grade_level: String(c.grade_level),
      section: c.section ?? "",
      academic_year_id: String(c.academic_year_id),
      homeroom_teacher_id: c.homeroom_teacher_id ? String(c.homeroom_teacher_id) : "",
      room: c.room ?? "",
      capacity: String(c.capacity),
    });
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        grade_level: Number(form.grade_level),
        section: form.section || null,
        academic_year_id: Number(form.academic_year_id),
        homeroom_teacher_id: form.homeroom_teacher_id ? Number(form.homeroom_teacher_id) : null,
        room: form.room || null,
        capacity: Number(form.capacity) || 45,
      };
      return editing
        ? api(`/classes/${editing.id}`, { method: "PUT", body: payload })
        : api("/classes", { method: "POST", body: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "បានកែប្រែថ្នាក់" : "បានបង្កើតថ្នាក់ថ្មី");
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: ["meta"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e: Error) => toast.error("រក្សាទុកមិនបានសម្រេច", e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/classes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("បានលុបថ្នាក់");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["meta"] });
    },
    onError: (e: Error) => toast.error("លុបមិនបានសម្រេច", e.message),
  });

  if (!meta) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink-950">ថ្នាក់រៀនទាំងអស់</h2>
          <p className="text-xs text-ink-500">
            {meta.classes.length} ថ្នាក់ · ឆ្នាំសិក្សា {meta.years.find((y) => y.id === meta.settings.academic_year_id)?.name}
          </p>
        </div>
        {isAdmin ? (
          <button className="btn-primary btn-sm ml-auto" onClick={openCreate}>
            <Plus size={15} /> បង្កើតថ្នាក់ថ្មី
          </button>
        ) : null}
      </div>

      {meta.years.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarRange}
            title="មិនទាន់មានឆ្នាំសិក្សា"
            description="ត្រូវការឆ្នាំសិក្សាមួយ ដើម្បីបង្កើតថ្នាក់រៀន។ សូមរៀបចំប្រព័ន្ធជាមុន។"
            action={
              isAdmin ? (
                <Link to="/setup" className="btn-primary btn-sm">
                  រៀបចំប្រព័ន្ធ
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : meta.classes.length === 0 ? (
        <div className="card">
          <EmptyState icon={School} title="មិនទាន់មានថ្នាក់" description="ចាប់ផ្ដើមដោយបង្កើតថ្នាក់ដំបូង" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {meta.classes.map((c) => (
            <div key={c.id} className="card group overflow-hidden">
              <div className="relative flex items-start gap-3 border-b border-ink-100 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-400 text-sm font-bold text-white">
                  {c.grade_level}
                  {c.name.slice(-1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink-950">ថ្នាក់ទី{c.grade_level}{c.name}</p>
                  <p className="text-[11px] text-ink-500">
                    បន្ទប់ {c.room ?? "—"} · ឆ្នាំ {c.year_name ?? "—"}
                  </p>
                </div>
                {isAdmin ? (
                  <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button className="btn-icon" onClick={() => openEdit(c)} title="កែប្រែ">
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn-icon text-rose-500 hover:bg-rose-50"
                      onClick={() => setDeleting(c)}
                      title="លុប"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-3 divide-x divide-ink-100 border-b border-ink-100">
                <div className="p-3 text-center">
                  <p className="text-[10px] text-ink-400">សិស្ស</p>
                  <p className="text-sm font-bold text-ink-900">{c.student_count ?? 0}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[10px] text-ink-400">មុខវិជ្ជា</p>
                  <p className="text-sm font-bold text-ink-900">{c.subject_count ?? 0}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[10px] text-ink-400">គ្រូបន្ទុក</p>
                  <p className="truncate text-[11px] font-semibold text-ink-800">{c.homeroom_name ?? "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3">
                <Link to={`/students?class=${c.id}`} className="btn-secondary btn-sm flex-1">
                  <Users size={13} /> សិស្ស
                </Link>
                <Link to={`/results?class_id=${c.id}`} className="btn-secondary btn-sm flex-1">
                  <BookOpen size={13} /> លទ្ធផល
                </Link>
                <button className="btn-secondary btn-sm flex-1" onClick={() => setSubjectsFor(c)}>
                  <Settings2 size={13} /> មុខវិជ្ជា
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "កែប្រែថ្នាក់រៀន" : "បង្កើតថ្នាក់ថ្មី"}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setFormOpen(false)}>
              បោះបង់
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (!form.name.trim()) return toast.error("សូមបញ្ចូលឈ្មោះថ្នាក់");
                save.mutate();
              }}
              disabled={save.isPending}
            >
              {save.isPending ? <Spinner /> : null} រក្សាទុក
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ឈ្មោះថ្នាក់" required hint="ឧ. 7A ឬ 9B">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="កម្រិតសិក្សា" required>
            <select className="input" value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })}>
              {[7, 8, 9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>
                  ថ្នាក់ទី {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ផ្នែក / ក" hint="ឧ. ក, ខ, គ">
            <input className="input" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
          </Field>
          <Field label="ឆ្នាំសិក្សា" required>
            <select
              className="input"
              value={form.academic_year_id}
              onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
            >
              {meta.years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="គ្រូបន្ទុកថ្នាក់">
            <select
              className="input"
              value={form.homeroom_teacher_id}
              onChange={(e) => setForm({ ...form, homeroom_teacher_id: e.target.value })}
            >
              <option value="">— មិនកំណត់ —</option>
              {meta.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="បន្ទប់រៀន">
            <input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="B-101" />
          </Field>
          <Field label="ចំណុះថ្នាក់">
            <input
              type="number"
              className="input"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      {deleting ? (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
          title="លុបថ្នាក់រៀន"
          message={`តើអ្នកប្រាកដជាចង់លុបថ្នាក់ទី${deleting.grade_level}${deleting.name}? មុខវិជ្ជា និងការកំណត់គ្រូនឹងត្រូវលុបផងដែរ (សិស្សត្រូវផ្ទេរចេញជាមុន)។`}
          confirmLabel="លុប"
          loading={remove.isPending}
        />
      ) : null}

      {subjectsFor ? (
        <ClassSubjectsModal
          cls={subjectsFor}
          onClose={() => setSubjectsFor(null)}
          canEdit={isAdmin}
        />
      ) : null}
    </div>
  );
}

function ClassSubjectsModal({ cls, onClose, canEdit }: { cls: ClassRoom; onClose: () => void; canEdit: boolean }) {
  const { data: meta } = useMeta();
  const qc = useQueryClient();
  const toast = useToast();
  const [addSubject, setAddSubject] = useState("");
  const [addTeacher, setAddTeacher] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["class-subjects", cls.id],
    queryFn: () => api<{ data: ClassSubject[] }>(`/classes/${cls.id}/subjects`),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["class-subjects", cls.id] });
    qc.invalidateQueries({ queryKey: ["meta"] });
  };

  const add = useMutation({
    mutationFn: () =>
      api(`/classes/${cls.id}/subjects`, {
        method: "POST",
        body: { subject_id: Number(addSubject), teacher_id: addTeacher ? Number(addTeacher) : null },
      }),
    onSuccess: () => {
      toast.success("បានបន្ថែមមុខវិជ្ជា");
      setAddSubject("");
      setAddTeacher("");
      refresh();
    },
    onError: (e: Error) => toast.error("បន្ថែមមិនបានសម្រេច", e.message),
  });

  const assign = useMutation({
    mutationFn: ({ id, teacherId }: { id: number; teacherId: number | null }) =>
      api(`/class-subjects/${id}`, { method: "PUT", body: { teacher_id: teacherId } }),
    onSuccess: () => {
      toast.success("បានផ្លាស់ប្ដូរគ្រូបង្រៀន");
      refresh();
    },
    onError: (e: Error) => toast.error("ផ្លាស់ប្ដូរមិនបានសម្រេច", e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/class-subjects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("បានដកមុខវិជ្ជា");
      refresh();
    },
    onError: (e: Error) => toast.error("ដកមិនបានសម្រេច", e.message),
  });

  const used = new Set((data?.data ?? []).map((s) => s.id));
  const available = (meta?.subjects ?? []).filter((s) => !used.has(s.id));

  return (
    <Modal
      open
      onClose={onClose}
      title={`មុខវិជ្ជា និងគ្រូបង្រៀន — ថ្នាក់ទី${cls.grade_level}${cls.name}`}
      description={`${data?.data.length ?? 0} មុខវិជ្ជា · ${cls.student_count ?? 0} សិស្ស`}
      size="lg"
      footer={
        <button className="btn-secondary" onClick={onClose}>
          បិទ
        </button>
      }
    >
      {isLoading ? (
        <PageLoader label="កំពុងផ្ទុក…" />
      ) : (
        <div className="space-y-3">
          <div className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200">
            {(data?.data ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-2.5">
                <span className="h-6 w-1.5 rounded-full" style={{ background: s.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink-900">{s.name_kh}</p>
                  <p className="text-[10.5px] text-ink-400">
                    {s.code} · {s.credits} ក្រេឌីត
                  </p>
                </div>
                {canEdit ? (
                  <select
                    className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-[11.5px] text-ink-700"
                    value={s.teacher_id ?? ""}
                    onChange={(e) =>
                      assign.mutate({ id: s.assignment_id, teacherId: e.target.value ? Number(e.target.value) : null })
                    }
                  >
                    <option value="">— គ្មានគ្រូ —</option>
                    {meta?.teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[11.5px] text-ink-500">{s.teacher_name ?? "—"}</span>
                )}
                {canEdit ? (
                  <button
                    className="btn-icon text-rose-500 hover:bg-rose-50"
                    onClick={() => remove.mutate(s.assignment_id)}
                    title="ដកចេញ"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            ))}
            {(data?.data.length ?? 0) === 0 ? <EmptyState title="មិនទាន់មានមុខវិជ្ជា" /> : null}
          </div>

          {canEdit && available.length > 0 ? (
            <div className="rounded-xl border border-dashed border-ink-300 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                <Plus size={12} /> បន្ថែមមុខវិជ្ជាថ្មី
              </p>
              <div className="flex flex-wrap gap-2">
                <select className="input flex-1" value={addSubject} onChange={(e) => setAddSubject(e.target.value)}>
                  <option value="">— ជ្រើសរើសមុខវិជ្ជា —</option>
                  {available.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name_kh}
                    </option>
                  ))}
                </select>
                <select className="input flex-1" value={addTeacher} onChange={(e) => setAddTeacher(e.target.value)}>
                  <option value="">— ជ្រើសរើសគ្រូ —</option>
                  {meta?.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-primary btn-sm"
                  disabled={!addSubject || add.isPending}
                  onClick={() => add.mutate()}
                >
                  {add.isPending ? <Spinner /> : <Plus size={14} />} បន្ថែម
                </button>
              </div>
            </div>
          ) : null}

          <p className="rounded-lg bg-brand-50 px-3 py-2 text-[11.5px] leading-relaxed text-brand-800">
            <UserRound size={12} className="mr-1 inline" />
            គ្រូដែលបានកំណត់សម្រាប់មុខវិជ្ជានីមួយៗ ទើបមានសិទ្ធិបញ្ចូល និងកែប្រែពិន្ទុ។
          </p>
        </div>
      )}
    </Modal>
  );
}
