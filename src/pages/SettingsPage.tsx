import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarRange,
  Check,
  GraduationCap,
  Plus,
  Save,
  Scale,
  Trash2,
} from "lucide-react";
import { api } from "../lib/api";
import type { GradeInfo, ScoreType, Term, AcademicYear } from "../lib/types";
import { EmptyState, Field, PageLoader, Spinner, Tabs } from "../components/ui";
import { useToast } from "../components/Toast";
import { GoogleOAuthCard } from "../components/GoogleOAuthCard";
import { cn, formatDate } from "../lib/utils";

interface SettingsResponse {
  settings: Record<string, string>;
  gradeScale: GradeInfo[];
  scoreTypes: ScoreType[];
  years: AcademicYear[];
  terms: Term[];
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<"school" | "grading" | "academic">("school");

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SettingsResponse>("/admin/settings"),
  });


  const [school, setSchool] = useState({
    school_name: "",
    school_name_en: "",
    school_address: "",
    school_phone: "",
    school_email: "",
    director_name: "",
    motto: "",
  });
  const [allowReg, setAllowReg] = useState(true);
  const [grading, setGrading] = useState({
    pass_mark: "50",
    max_score: "100",
    attendance_absent_limit: "20",
    scale: [] as GradeInfo[],
    types: [] as ScoreType[],
  });
  const [newYear, setNewYear] = useState({ name: "", start_date: "", end_date: "" });

  useEffect(() => {
    if (!data) return;
    setSchool({
      school_name: data.settings.school_name ?? "",
      school_name_en: data.settings.school_name_en ?? "",
      school_address: data.settings.school_address ?? "",
      school_phone: data.settings.school_phone ?? "",
      school_email: data.settings.school_email ?? "",
      director_name: data.settings.director_name ?? "",
      motto: data.settings.motto ?? "",
    });
    setAllowReg((data.settings.allow_registration ?? "1") !== "0");
    setGrading({
      pass_mark: data.settings.pass_mark ?? "50",
      max_score: data.settings.max_score ?? "100",
      attendance_absent_limit: data.settings.attendance_absent_limit ?? "20",
      scale: [...data.gradeScale].sort((a, b) => b.min - a.min),
      types: [...data.scoreTypes],
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api("/admin/settings", {
        method: "PUT",
        body: {
          ...school,
          pass_mark: Number(grading.pass_mark),
          max_score: Number(grading.max_score),
          attendance_absent_limit: Number(grading.attendance_absent_limit),
          allow_registration: allowReg ? "1" : "0",
          grade_scale: grading.scale,
          scoreTypes: grading.types.map((t) => ({ id: t.id, weight: t.weight })),
        },
      }),
    onSuccess: () => {
      toast.success("បានរក្សាទុកការកំណត់", "ការផ្លាស់ប្ដូរនឹងមានប្រសិទ្ធភាពភ្លាមៗ");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["results"] });
    },
    onError: (e: Error) => toast.error("រក្សាទុកមិនបានសម្រេច", e.message),
  });

  const createYear = useMutation({
    mutationFn: () => api("/admin/years", { method: "POST", body: newYear }),
    onSuccess: () => {
      toast.success("បានបង្កើតឆ្នាំសិក្សាថ្មី", "បានបង្កើតឆមាសទី១ និងទី២ ដោយស្វ័យប្រវត្តិ");
      setNewYear({ name: "", start_date: "", end_date: "" });
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
    },
    onError: (e: Error) => toast.error("បង្កើតមិនបានសម្រេច", e.message),
  });

  const updateYear = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/admin/years/${id}`, { method: "PUT", body }),
    onSuccess: () => {
      toast.success("បានធ្វើបច្ចុប្បន្នភាពឆ្នាំសិក្សា");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
    },
    onError: (e: Error) => toast.error("ធ្វើបច្ចុប្បន្នភាពបរាជ័យ", e.message),
  });

  const updateTerm = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/admin/terms/${id}`, { method: "PUT", body }),
    onSuccess: () => {
      toast.success("បានធ្វើបច្ចុប្បន្នភាពឆមាស");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error("ធ្វើបច្ចុប្បន្នភាពបរាជ័យ", e.message),
  });

  if (isLoading || !data) return <PageLoader label="កំពុងផ្ទុកការកំណត់…" />;

  const weightTotal = grading.types.reduce((a, b) => a + Number(b.weight || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "school", label: "ព័ត៌មានសាលា" },
            { value: "grading", label: "ប្រព័ន្ធវាយតម្លៃ" },
            { value: "academic", label: "ឆ្នាំសិក្សា" },
          ]}
        />
        {tab !== "academic" ? (
          <button className="btn-primary btn-sm ml-auto" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : <Save size={14} />} រក្សាទុកការកំណត់
          </button>
        ) : null}
      </div>

      {tab === "school" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card p-4 lg:col-span-2">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Building2 size={16} className="text-brand-500" /> ព័ត៌មានសាលារៀន
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ឈ្មោះសាលា (ខ្មែរ)" required className="sm:col-span-2">
                <input className="input" value={school.school_name} onChange={(e) => setSchool({ ...school, school_name: e.target.value })} />
              </Field>
              <Field label="ឈ្មោះសាលា (អង់គ្លេស)" className="sm:col-span-2">
                <input
                  className="input"
                  value={school.school_name_en}
                  onChange={(e) => setSchool({ ...school, school_name_en: e.target.value })}
                />
              </Field>
              <Field label="អាសយដ្ឋាន" className="sm:col-span-2">
                <input className="input" value={school.school_address} onChange={(e) => setSchool({ ...school, school_address: e.target.value })} />
              </Field>
              <Field label="លេខទូរស័ព្ទ">
                <input className="input" value={school.school_phone} onChange={(e) => setSchool({ ...school, school_phone: e.target.value })} />
              </Field>
              <Field label="អ៊ីមែល">
                <input className="input" value={school.school_email} onChange={(e) => setSchool({ ...school, school_email: e.target.value })} />
              </Field>
              <Field label="ឈ្មោះនាយកសាលា">
                <input className="input" value={school.director_name} onChange={(e) => setSchool({ ...school, director_name: e.target.value })} />
              </Field>
              <Field label="ស្លោកសម្គាល់សាលា">
                <input className="input" value={school.motto} onChange={(e) => setSchool({ ...school, motto: e.target.value })} />
              </Field>
              <div className="sm:col-span-2 rounded-xl border border-ink-200 bg-ink-50/60 p-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={allowReg}
                    onChange={(e) => setAllowReg(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600"
                  />
                  <span>
                    <span className="block text-[12.5px] font-medium text-ink-800">
                      អនុញ្ញាតឱ្យគ្រូបង្រៀនចុះឈ្មោះដោយ Gmail ដោយខ្លួនឯង
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-500">
                      បើបិទ មានតែអ្នកគ្រប់គ្រងទេដែលអាចបង្កើតគណនីថ្មី។ គណនីដំបូងតែងតែជាអ្នកគ្រប់គ្រង។
                    </span>
                  </span>
                </label>
              </div>

              <GoogleOAuthCard />
            </div>
          </section>

          <section className="card h-fit p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink-900">ការមើលជាមុន</h3>
            <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4 text-center">
              <p className="text-[11px] font-semibold text-ink-600">ព្រះរាជាណាចក្រកម្ពុជា</p>
              <p className="text-[10px] text-ink-500">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
              <div className="mx-auto my-1.5 h-px w-16 bg-ink-300" />
              <p className="text-[13px] font-bold text-ink-950">{school.school_name || "ឈ្មោះសាលា"}</p>
              <p className="text-[10px] text-ink-500">{school.school_name_en}</p>
              <p className="mt-1 text-[9.5px] text-ink-400">{school.school_address}</p>
              <p className="mt-2 text-[10px] italic text-ink-500">“{school.motto || "ស្លោកសម្គាល់"}”</p>
              <p className="mt-2 text-[10px] text-ink-500">នាយកសាលា: {school.director_name || "—"}</p>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
              ព័ត៌មាននេះបង្ហាញនៅលើសៀវភៅពិន្ទុ សញ្ញាបត្រ និងបញ្ជីលទ្ធផលដែលបោះពុម្ព។
            </p>
            <div className="mt-4 border-t border-ink-100 pt-3 text-center text-[10.5px] leading-relaxed text-ink-400">
              ប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស v1.0
              <br />© {new Date().getFullYear()} រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ
              <span className="font-semibold text-ink-600"> វណ្ណា វណ្ណឆៃ</span>
            </div>
          </section>
        </div>
      ) : tab === "grading" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Scale size={16} className="text-brand-500" /> កម្រិតគណនា
            </h3>
            <div className="space-y-3">
              <Field label="ពិន្ទុពេញ" hint="ពិន្ទុអតិបរមាសម្រាប់ការវាយតម្លៃនីមួយៗ">
                <input
                  type="number"
                  className="input"
                  value={grading.max_score}
                  onChange={(e) => setGrading({ ...grading, max_score: e.target.value })}
                />
              </Field>
              <Field label="ពិន្ទុជាប់អប្បបរមា" hint="សិស្សដែលមធ្យមភាគក្រោមនេះ ចាត់ទុកថាធ្លាក់">
                <input
                  type="number"
                  className="input"
                  value={grading.pass_mark}
                  onChange={(e) => setGrading({ ...grading, pass_mark: e.target.value })}
                />
              </Field>
              <Field label="កំណត់អវត្តមានអនុញ្ញាត" hint="ចំនួនថ្ងៃអវត្តមានអតិបរមាក្នុងមួយឆមាស">
                <input
                  type="number"
                  className="input"
                  value={grading.attendance_absent_limit}
                  onChange={(e) => setGrading({ ...grading, attendance_absent_limit: e.target.value })}
                />
              </Field>
            </div>
          </section>

          <section className="card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <GraduationCap size={16} className="text-brand-500" /> មាត្រដ្ឋាននិទ្ទេស
            </h3>
            <div className="space-y-2">
              {grading.scale.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="input w-14 text-center font-bold"
                    value={g.grade}
                    onChange={(e) => {
                      const next = [...grading.scale];
                      next[i] = { ...g, grade: e.target.value };
                      setGrading({ ...grading, scale: next });
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-ink-500">≥</span>
                    <input
                      type="number"
                      className="input w-20 text-center"
                      value={g.min}
                      onChange={(e) => {
                        const next = [...grading.scale];
                        next[i] = { ...g, min: Number(e.target.value) };
                        setGrading({ ...grading, scale: next });
                      }}
                    />
                  </div>
                  <input
                    className="input flex-1"
                    value={g.remark}
                    onChange={(e) => {
                      const next = [...grading.scale];
                      next[i] = { ...g, remark: e.target.value };
                      setGrading({ ...grading, scale: next });
                    }}
                  />
                  <button
                    className="btn-icon text-rose-500 hover:bg-rose-50"
                    onClick={() => setGrading({ ...grading, scale: grading.scale.filter((_, j) => j !== i) })}
                    title="លុបកម្រិត"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                className="btn-secondary btn-sm w-full"
                onClick={() => setGrading({ ...grading, scale: [...grading.scale, { grade: "", min: 0, remark: "" }] })}
              >
                <Plus size={14} /> បន្ថែមកម្រិត
              </button>
            </div>
          </section>

          <section className="card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Check size={16} className="text-brand-500" /> ទម្ងន់ប្រភេទពិន្ទុ
            </h3>
            <div className="space-y-2">
              {grading.types.map((t, i) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border border-ink-200 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink-800">{t.name_kh}</p>
                    <p className="text-[10px] text-ink-400">{t.name_en}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="input w-16 text-center"
                      value={t.weight}
                      onChange={(e) => {
                        const next = [...grading.types];
                        next[i] = { ...t, weight: Number(e.target.value) };
                        setGrading({ ...grading, types: next });
                      }}
                    />
                    <span className="text-[11px] text-ink-500">%</span>
                  </div>
                </div>
              ))}
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-[11.5px] font-medium",
                  weightTotal === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                )}
              >
                <span>ផលបូកទម្ងន់</span>
                <span>{weightTotal}%</span>
              </div>
              <p className="text-[10.5px] leading-relaxed text-ink-400">
                ទម្ងន់មិនចាំបាច់ស្មើ ១០០% ទេ — ប្រព័ន្ធគណនាមធ្យមភាគដោយបែងចែកតាមផលបូកទម្ងន់ពិតជានិច្ច។
              </p>
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card p-4 lg:col-span-2">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <CalendarRange size={16} className="text-brand-500" /> ឆ្នាំសិក្សា និងឆមាស
            </h3>
            <div className="space-y-3">
              {data.years.map((y) => {
                const yearTerms = data.terms.filter((t) => t.academic_year_id === y.id);
                return (
                  <div key={y.id} className="rounded-xl border border-ink-200">
                    <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-3 py-2.5">
                      <span className="text-[13px] font-semibold text-ink-900">{y.name}</span>
                      <span className="text-[11px] text-ink-400">
                        {formatDate(y.start_date)} – {formatDate(y.end_date)}
                      </span>
                      {y.is_current ? (
                        <span className="badge bg-emerald-50 text-emerald-700">បច្ចុប្បន្ន</span>
                      ) : (
                        <button
                          className="btn-ghost btn-sm ml-auto"
                          onClick={() => updateYear.mutate({ id: y.id, body: { is_current: true } })}
                        >
                          កំណត់ជាឆ្នាំបច្ចុប្បន្ន
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-ink-100">
                      {yearTerms.map((t) => (
                        <div key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                          <span className="w-24 text-[12px] font-medium text-ink-800">{t.name}</span>
                          <input
                            type="date"
                            className="rounded-lg border border-ink-200 px-2 py-1 text-[11px] text-ink-600"
                            defaultValue={t.start_date ?? ""}
                            onBlur={(e) => updateTerm.mutate({ id: t.id, body: { start_date: e.target.value } })}
                          />
                          <span className="text-ink-300">→</span>
                          <input
                            type="date"
                            className="rounded-lg border border-ink-200 px-2 py-1 text-[11px] text-ink-600"
                            defaultValue={t.end_date ?? ""}
                            onBlur={(e) => updateTerm.mutate({ id: t.id, body: { end_date: e.target.value } })}
                          />
                          {t.is_current ? (
                            <span className="badge ml-auto bg-brand-50 text-brand-700">ឆមាសបច្ចុប្បន្ន</span>
                          ) : (
                            <button
                              className="btn-ghost btn-sm ml-auto"
                              onClick={() => updateTerm.mutate({ id: t.id, body: { is_current: true } })}
                            >
                              កំណត់ជាបច្ចុប្បន្ន
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {data.years.length === 0 ? <EmptyState title="មិនទាន់មានឆ្នាំសិក្សា" /> : null}
            </div>
          </section>

          <section className="card h-fit p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Plus size={16} className="text-brand-500" /> បង្កើតឆ្នាំសិក្សាថ្មី
            </h3>
            <div className="space-y-3">
              <Field label="ឈ្មោះឆ្នាំសិក្សា" required hint="ឧ. 2027-2028">
                <input
                  className="input"
                  value={newYear.name}
                  onChange={(e) => setNewYear({ ...newYear, name: e.target.value })}
                  placeholder="2027-2028"
                />
              </Field>
              <Field label="ថ្ងៃចាប់ផ្ដើម">
                <input
                  type="date"
                  className="input"
                  value={newYear.start_date}
                  onChange={(e) => setNewYear({ ...newYear, start_date: e.target.value })}
                />
              </Field>
              <Field label="ថ្ងៃបញ្ចប់">
                <input
                  type="date"
                  className="input"
                  value={newYear.end_date}
                  onChange={(e) => setNewYear({ ...newYear, end_date: e.target.value })}
                />
              </Field>
              <button
                className="btn-primary btn-sm w-full"
                disabled={!newYear.name.trim() || createYear.isPending}
                onClick={() => createYear.mutate()}
              >
                {createYear.isPending ? <Spinner /> : <Plus size={14} />} បង្កើតឆ្នាំសិក្សា
              </button>
              <p className="text-[10.5px] leading-relaxed text-ink-400">
                ឆមាសទី១ និងទី២ នឹងត្រូវបង្កើតស្វ័យប្រវត្តិសម្រាប់ឆ្នាំសិក្សាថ្មី។
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
