import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Subject } from "../lib/types";
import { ConfirmDialog, EmptyState, Field, Modal, Spinner, TableSkeleton } from "../components/ui";
import { useToast } from "../components/Toast";
import { cn } from "../lib/utils";

const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899"];

export default function SubjectsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const isAdmin = user?.role === "admin";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [form, setForm] = useState({ code: "", name_kh: "", name_en: "", credits: "1", color: COLORS[7], is_active: true });

  const { data, isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api<{ data: Subject[] }>("/subjects"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name_kh: "", name_en: "", credits: "1", color: COLORS[7], is_active: true });
    setOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({
      code: s.code,
      name_kh: s.name_kh,
      name_en: s.name_en,
      credits: String(s.credits),
      color: s.color,
      is_active: !!s.is_active,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name_kh: form.name_kh.trim(),
        name_en: form.name_en.trim() || form.name_kh.trim(),
        credits: Number(form.credits) || 1,
        color: form.color,
        is_active: form.is_active,
      };
      return editing
        ? api(`/subjects/${editing.id}`, { method: "PUT", body: payload })
        : api("/subjects", { method: "POST", body: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "បានកែប្រែមុខវិជ្ជា" : "បានបង្កើតមុខវិជ្ជាថ្មី");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
    },
    onError: (e: Error) => toast.error("រក្សាទុកមិនបានសម្រេច", e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/subjects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("បានលុបមុខវិជ្ជា");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
    },
    onError: (e: Error) => toast.error("លុបមិនបានសម្រេច", e.message),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink-950">មុខវិជ្ជាសិក្សា</h2>
          <p className="text-xs text-ink-500">{data?.data.length ?? 0} មុខវិជ្ជា · ក្រេឌីតប្រើសម្រាប់គណនាមធ្យមភាគ</p>
        </div>
        {isAdmin ? (
          <button className="btn-primary btn-sm ml-auto" onClick={openCreate}>
            <Plus size={15} /> បន្ថែមមុខវិជ្ជា
          </button>
        ) : null}
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-ink-50/70">
              <tr>
                <th className="th">មុខវិជ្ជា</th>
                <th className="th">កូដ</th>
                <th className="th text-center">ក្រេឌីត</th>
                <th className="th text-center">ថ្នាក់ប្រើប្រាស់</th>
                <th className="th text-center">ពិន្ទុបានបញ្ចូល</th>
                <th className="th text-center">ស្ថានភាព</th>
                {isAdmin ? <th className="th text-right">សកម្មភាព</th> : null}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7}>
                    <TableSkeleton rows={6} cols={5} />
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={BookOpen} title="មិនទាន់មានមុខវិជ្ជា" />
                  </td>
                </tr>
              ) : (
                data?.data.map((s) => (
                  <tr key={s.id} className="table-row">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <span className="h-7 w-1.5 rounded-full" style={{ background: s.color }} />
                        <div>
                          <p className="text-[13px] font-medium text-ink-900">{s.name_kh}</p>
                          <p className="text-[10.5px] text-ink-400">{s.name_en}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <span className="badge bg-ink-100 font-mono text-ink-600">{s.code}</span>
                    </td>
                    <td className="td text-center">{s.credits}</td>
                    <td className="td text-center">{s.class_count ?? 0}</td>
                    <td className="td text-center">{s.score_count ?? 0}</td>
                    <td className="td text-center">
                      <span className={cn("badge", s.is_active ? "bg-emerald-50 text-emerald-700" : "bg-ink-100 text-ink-500")}>
                        {s.is_active ? "ដំណើរការ" : "បិទ"}
                      </span>
                    </td>
                    {isAdmin ? (
                      <td className="td">
                        <div className="flex justify-end gap-0.5">
                          <button className="btn-icon" onClick={() => openEdit(s)} title="កែប្រែ">
                            <Pencil size={15} />
                          </button>
                          <button
                            className="btn-icon text-rose-500 hover:bg-rose-50"
                            onClick={() => setDeleting(s)}
                            title="លុប"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "កែប្រែមុខវិជ្ជា" : "បន្ថែមមុខវិជ្ជាថ្មី"}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              បោះបង់
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (!form.code.trim() || !form.name_kh.trim()) return toast.error("សូមបញ្ចូលកូដ និងឈ្មោះមុខវិជ្ជា");
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
          <Field label="កូដមុខវិជ្ជា" required hint="ឧ. MATH, KHM, ENG">
            <input className="input font-mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="ក្រេឌីត">
            <input
              type="number"
              step="0.5"
              min="0.5"
              className="input"
              value={form.credits}
              onChange={(e) => setForm({ ...form, credits: e.target.value })}
            />
          </Field>
          <Field label="ឈ្មោះជាភាសាខ្មែរ" required className="sm:col-span-2">
            <input className="input" value={form.name_kh} onChange={(e) => setForm({ ...form, name_kh: e.target.value })} />
          </Field>
          <Field label="ឈ្មោះជាភាសាអង់គ្លេស" className="sm:col-span-2">
            <input className="input" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
          </Field>
          <Field label="ពណ៌តំណាង" className="sm:col-span-2">
            <div className="flex flex-wrap gap-2 pt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition",
                    form.color === c ? "border-ink-900 scale-110" : "border-white",
                  )}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </Field>
          <label className="flex items-center gap-2 text-[12.5px] text-ink-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
            />
            មុខវិជ្ជានេះកំពុងដំណើរការ
          </label>
        </div>
      </Modal>

      {deleting ? (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
          title="លុបមុខវិជ្ជា"
          message={`តើអ្នកប្រាកដជាចង់លុប «${deleting.name_kh}»? មុខវិជ្ជាដែលមានពិន្ទុរួចហើយ មិនអាចលុបបានទេ។`}
          confirmLabel="លុប"
          loading={remove.isPending}
        />
      ) : null}

    </div>
  );
}
