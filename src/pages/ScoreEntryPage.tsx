import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Info,
  Lock,
  RotateCcw,
  Save,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import { useAuth } from "../lib/auth";
import type { ScoreType } from "../lib/types";
import { EmptyState, PageLoader, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { cn, formatNumber, formatScore } from "../lib/utils";

interface ScoreGridResponse {
  students: { id: number; code: string; name_kh: string; gender: string }[];
  scoreTypes: ScoreType[];
  scores: Record<string, number>;
  canEdit: boolean;
  subject: { id: number; name_kh: string; name_en: string; credits: number; color: string } | null;
  class: { id: number; name: string; grade_level: number } | null;
  term: { id: number; name: string } | null;
  teacherName: string | null;
  lastUpdate: string | null;
  maxScore: number;
}

const keyOf = (studentId: number, code: string) => `${studentId}|${code}`;

export default function ScoreEntryPage() {
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const toast = useToast();
  const qc = useQueryClient();

  const [classId, setClassId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [termId, setTermId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: assignments } = useQuery({
    queryKey: ["my-assignments"],
    queryFn: () =>
      api<{ data: { class_id: number; class_name: string; subject_id: number; subject_name: string }[] }>(
        "/scores/my-assignments",
      ),
    enabled: !!user,
  });

  useEffect(() => {
    if (!meta) return;
    setTermId((t) => t ?? meta.settings.term_id);
    if (user?.role !== "admin" && assignments?.data.length) {
      setClassId((c) => c ?? assignments.data[0].class_id);
      setSubjectId((s) => s ?? assignments.data[0].subject_id);
    } else {
      setClassId((c) => c ?? meta.classes[0]?.id ?? null);
      setSubjectId((s) => s ?? meta.subjects[0]?.id ?? null);
    }
  }, [meta, assignments, user]);

  const ready = !!classId && !!subjectId && !!termId;

  const { data, isLoading } = useQuery({
    queryKey: ["scores", classId, subjectId, termId],
    queryFn: () =>
      api<ScoreGridResponse>("/scores", {
        query: { class_id: classId, subject_id: subjectId, term_id: termId },
      }),
    enabled: ready,
  });

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.scores)) next[k] = String(v);
    setDraft(next);
    setDirty(false);
  }, [data]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const scoreTypes = data?.scoreTypes ?? [];
  const students = data?.students ?? [];
  const maxScore = data?.maxScore ?? 100;

  const weightOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of scoreTypes) map.set(t.code, t.weight);
    return map;
  }, [scoreTypes]);

  const averageOf = useCallback(
    (studentId: number) => {
      let weighted = 0;
      let sum = 0;
      for (const t of scoreTypes) {
        const raw = draft[keyOf(studentId, t.code)];
        if (raw === undefined || raw === "") continue;
        const n = Number(raw);
        if (Number.isNaN(n)) continue;
        weighted += n * t.weight;
        sum += t.weight;
      }
      return sum > 0 ? weighted / sum : null;
    },
    [draft, scoreTypes],
  );

  const filled = useMemo(
    () => Object.values(draft).filter((v) => v !== "").length,
    [draft],
  );
  const totalCells = students.length * scoreTypes.length;
  const progress = totalCells ? Math.round((filled / totalCells) * 100) : 0;

  const stats = useMemo(() => {
    const avgs = students.map((s) => averageOf(s.id)).filter((v): v is number => v !== null);
    return {
      entered: avgs.length,
      classAverage: avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null,
      highest: avgs.length ? Math.max(...avgs) : null,
    };
  }, [students, averageOf]);

  const setCell = (studentId: number, code: string, value: string) => {
    const key = keyOf(studentId, code);
    const cleaned = value.replace(/[^\d.]/g, "");
    if (cleaned !== "" && Number(cleaned) > maxScore) {
      setDraft((d) => ({ ...d, [key]: String(maxScore) }));
    } else {
      setDraft((d) => ({ ...d, [key]: cleaned }));
    }
    setDirty(true);
  };

  const moveFocus = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (!["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
    e.preventDefault();
    const delta = e.key === "ArrowUp" ? -1 : 1;
    const row = rowIndex + delta;
    if (row < 0 || row >= students.length) return;
    const next = document.getElementById(`score-${students[row].id}-${scoreTypes[colIndex].code}`) as HTMLInputElement | null;
    next?.focus();
    next?.select();
  };

  const save = async () => {
    if (!data || !classId || !subjectId || !termId) return;
    const entries: { student_id: number; score_type_id: number; score: number | null }[] = [];
    for (const s of students) {
      for (const t of scoreTypes) {
        const key = keyOf(s.id, t.code);
        const nowRaw = draft[key] ?? "";
        const beforeRaw = data.scores[key] !== undefined ? String(data.scores[key]) : "";
        if (nowRaw === beforeRaw) continue;
        entries.push({
          student_id: s.id,
          score_type_id: t.id,
          score: nowRaw === "" ? null : Number(nowRaw),
        });
      }
    }
    if (entries.length === 0) {
      toast.info("គ្មានការផ្លាស់ប្ដូរត្រូវរក្សាទុក");
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ saved: number }>("/scores/bulk", {
        method: "PUT",
        body: { class_id: classId, subject_id: subjectId, term_id: termId, entries },
      });
      toast.success("បានរក្សាទុកពិន្ទុ", `${res.saved} កំណត់ · មធ្យមភាគត្រូវបានគណនាឡើងវិញ`);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["scores"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["results"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    } catch (e: any) {
      toast.error("រក្សាទុកមិនបានសម្រេច", e.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && data?.canEdit) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const fillMissing = () => {
    if (!students.length) return;
    const next = { ...draft };
    for (const s of students) {
      for (const t of scoreTypes) {
        const k = keyOf(s.id, t.code);
        if (!next[k]) next[k] = "";
      }
    }
    setDraft(next);
    toast.info("សូមបញ្ចូលពិន្ទុក្នុងប្រអប់ដែលទទេ", "អ្នកអាចប្រើប៊ូតុង Tab ឬ Enter ដើម្បីផ្លាស់ទី");
  };

  const resetDraft = () => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.scores)) next[k] = String(v);
    setDraft(next);
    setDirty(false);
    toast.info("បានដកការផ្លាស់ប្ដូរដែលមិនបានរក្សាទុកវិញ");
  };

  /* selector options */
  const teacherClasses = useMemo(() => {
    if (user?.role === "admin" || !assignments) return meta?.classes ?? [];
    const ids = new Set(assignments.data.map((a) => a.class_id));
    return (meta?.classes ?? []).filter((c) => ids.has(c.id));
  }, [assignments, meta, user]);

  const teacherSubjects = useMemo(() => {
    if (user?.role === "admin" || !assignments) return meta?.subjects ?? [];
    const ids = new Set(assignments.data.filter((a) => a.class_id === classId).map((a) => a.subject_id));
    return (meta?.subjects ?? []).filter((s) => ids.has(s.id));
  }, [assignments, meta, user, classId]);

  useEffect(() => {
    if (user?.role === "admin") return;
    if (teacherSubjects.length && !teacherSubjects.some((s) => s.id === subjectId)) {
      setSubjectId(teacherSubjects[0].id);
    }
  }, [teacherSubjects, subjectId, user]);

  if (user?.role !== "admin" && assignments && assignments.data.length === 0) {
    return (
      <div className="card animate-fade-in">
        <EmptyState
          icon={Lock}
          title="អ្នកមិនទាន់មានមុខវិជ្ជាដែលបានចាត់តាំង"
          description="សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ ដើម្បីចាត់តាំងថ្នាក់ និងមុខវិជ្ជាដែលអ្នកបង្រៀន។"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Selectors */}
      <section className="card p-3.5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[150px] flex-1">
            <label className="label">ថ្នាក់រៀន</label>
            <select
              className="input"
              value={classId ?? ""}
              onChange={(e) => {
                setClassId(Number(e.target.value));
                setDraft({});
              }}
            >
              {teacherClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  ថ្នាក់ទី{c.grade_level}{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[170px] flex-1">
            <label className="label">មុខវិជ្ជា</label>
            <select
              className="input"
              value={subjectId ?? ""}
              onChange={(e) => {
                setSubjectId(Number(e.target.value));
                setDraft({});
              }}
            >
              {teacherSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_kh}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[190px] flex-1">
            <label className="label">ឆមាសសិក្សា</label>
            <select className="input" value={termId ?? ""} onChange={(e) => setTermId(Number(e.target.value))}>
              {meta?.terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {meta.years.find((y) => y.id === t.academic_year_id)?.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <button className="btn-secondary btn-sm" onClick={resetDraft} disabled={!dirty || saving}>
              <RotateCcw size={14} /> ត្រឡប់វិញ
            </button>
            <button
              className="btn-primary btn-sm"
              onClick={save}
              disabled={!dirty || saving || !data?.canEdit}
              title="Ctrl + S"
            >
              {saving ? <Spinner /> : <Save size={15} />} រក្សាទុក
            </button>
          </div>
        </div>
      </section>

      {!ready || isLoading ? (
        <PageLoader label="កំពុងផ្ទុកតារាងពិន្ទុ…" />
      ) : !data ? (
        <EmptyState title="មិនអាចផ្ទុកបាន" />
      ) : (
        <>
          {/* header info */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="card flex flex-1 items-center gap-3 px-4 py-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ background: data.subject?.color ?? "#3462f5" }}
              >
                <ClipboardList size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-950">{data.subject?.name_kh}</p>
                <p className="text-[11.5px] text-ink-500">
                  ថ្នាក់ទី{data.class?.grade_level}
                  {data.class?.name} · {data.term?.name} · គ្រូ: {data.teacherName ?? "មិនបានកំណត់"}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-4 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-ink-400">បានបញ្ចូល</p>
                  <p className="text-sm font-bold text-ink-900">
                    {filled}/{totalCells}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-ink-400">មធ្យមភាគថ្នាក់</p>
                  <p className="text-sm font-bold text-brand-700">{formatNumber(stats.classAverage)}</p>
                </div>
              </div>
            </div>
            <div className="card w-full px-4 py-3 sm:w-[230px]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-500">វឌ្ឍនភាពបញ្ចូលពិន្ទុ</span>
                <span className="font-semibold text-ink-800">{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    progress === 100 ? "bg-emerald-500" : progress > 50 ? "bg-brand-500" : "bg-amber-500",
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10.5px] text-ink-400">
                {data.lastUpdate ? `ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ ${data.lastUpdate.slice(0, 16)}` : "មិនទាន់មានពិន្ទុ"}
              </p>
            </div>
          </div>

          {!data.canEdit ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
              <Lock size={16} className="mt-0.5 shrink-0" />
              <p>
                អ្នកអាចមើលពិន្ទុបាន ប៉ុន្តែមិនមានសិទ្ធិកែប្រែទេ។ សិទ្ធិបញ្ចូលពិន្ទុជាកម្មសិទ្ធិរបស់គ្រូដែលបានកំណត់
                សម្រាប់មុខវិជ្ជានេះ។
              </p>
            </div>
          ) : dirty ? (
            <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-[12.5px] text-brand-800">
              <Info size={15} /> អ្នកមានការផ្លាស់ប្ដូរដែលមិនបានរក្សាទុក — ចុច <b>Ctrl + S</b> ដើម្បីរក្សាទុក
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12.5px] text-emerald-800">
              <CheckCircle2 size={15} /> រាល់ការផ្លាស់ប្ដូរត្រូវបានរក្សាទុករួចរាល់
            </div>
          )}

          {/* grid */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-ink-400" />
                <h3 className="text-sm font-semibold text-ink-900">តារាងបញ្ចូលពិន្ទុ</h3>
                <span className="badge bg-ink-100 text-ink-600">{students.length} នាក់</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
                {scoreTypes.map((t) => (
                  <span key={t.id} className="badge bg-ink-50 text-ink-500">
                    {t.name_kh} · {t.weight}%
                  </span>
                ))}
              </div>
            </div>

            {students.length === 0 ? (
              <EmptyState
                icon={Users}
                title="ថ្នាក់នេះគ្មានសិស្ស"
                description="សូមបន្ថែមសិស្សចូលថ្នាក់ជាមុនសិន"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-ink-50/80">
                      <th className="th sticky left-0 z-10 bg-ink-50/95 backdrop-blur">#</th>
                      <th className="th sticky left-10 z-10 min-w-[200px] bg-ink-50/95 backdrop-blur">ឈ្មោះសិស្ស</th>
                      {scoreTypes.map((t) => (
                        <th key={t.id} className="th text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{t.name_kh}</span>
                            <span className="text-[9.5px] font-normal text-ink-400">{t.weight}%</span>
                          </div>
                        </th>
                      ))}
                      <th className="th text-center">មធ្យមភាគ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, rowIndex) => {
                      const avg = averageOf(s.id);
                      return (
                        <tr key={s.id} className="group border-t border-ink-100 hover:bg-brand-50/30">
                          <td className="td sticky left-0 z-10 bg-white text-[11px] text-ink-400 group-hover:bg-brand-50/60">
                            {rowIndex + 1}
                          </td>
                          <td className="td sticky left-10 z-10 min-w-[200px] bg-white group-hover:bg-brand-50/60">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold",
                                  s.gender === "M" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700",
                                )}
                              >
                                {s.name_kh.charAt(0)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[12.5px] font-medium text-ink-900">{s.name_kh}</p>
                                <p className="text-[10.5px] text-ink-400">{s.code}</p>
                              </div>
                            </div>
                          </td>
                          {scoreTypes.map((t, colIndex) => {
                            const key = keyOf(s.id, t.code);
                            const value = draft[key] ?? "";
                            const missing = value === "";
                            return (
                              <td key={t.id} className="px-1.5 py-1 text-center">
                                <input
                                  id={`score-${s.id}-${t.code}`}
                                  type="text"
                                  inputMode="decimal"
                                  disabled={!data.canEdit}
                                  value={value}
                                  onChange={(e) => setCell(s.id, t.code, e.target.value)}
                                  onKeyDown={(e) => moveFocus(e, rowIndex, colIndex)}
                                  onFocus={(e) => e.target.select()}
                                  placeholder="—"
                                  className={cn(
                                    "mx-auto h-9 w-[68px] rounded-lg border text-center text-[13px] font-medium outline-none transition",
                                    missing
                                      ? "border-ink-200 bg-ink-50/60 text-ink-400 placeholder:text-ink-300"
                                      : "border-ink-200 bg-white text-ink-900",
                                    "focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20",
                                    "disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400",
                                  )}
                                />
                              </td>
                            );
                          })}
                          <td className="td text-center">
                            <span
                              className={cn(
                                "inline-flex min-w-[58px] items-center justify-center rounded-lg px-2 py-1 text-[12.5px] font-bold",
                                avg === null
                                  ? "bg-ink-50 text-ink-300"
                                  : avg < (meta?.settings.pass_mark ?? 50)
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-emerald-50 text-emerald-700",
                              )}
                            >
                              {avg === null ? "—" : formatScore(Math.round(avg * 100) / 100)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 bg-ink-50/50 px-4 py-2.5 text-[11.5px] text-ink-500">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-500" />
                  មធ្យមភាគ = ផលបូក(ពិន្ទុ × ទម្ងន់) ÷ ផលបូកទម្ងន់
                </span>
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-emerald-500" />
                  ខ្ពស់បំផុត {formatNumber(stats.highest)}
                </span>
                <span className="flex items-center gap-1.5">
                  <AlertCircle size={13} className="text-brand-500" />
                  ពិន្ទុពេញ {maxScore}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-ghost btn-sm" onClick={fillMissing} disabled={!data.canEdit}>
                  បង្ហាញប្រអប់ទទេ
                </button>
                <button className="btn-primary btn-sm" onClick={save} disabled={!dirty || saving || !data.canEdit}>
                  {saving ? <Spinner /> : <Save size={14} />} រក្សាទុកទាំងអស់
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
