import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarRange,
  Check,
  CheckCircle2,
  GraduationCap,
  Info,
  School,
  Sparkles,
} from "lucide-react";
import { api } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import type { AcademicYear, GradeInfo, ScoreType } from "../lib/types";
import { Field, PageLoader, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { cn } from "../lib/utils";

interface SettingsResponse {
  settings: Record<string, string>;
  gradeScale: GradeInfo[];
  scoreTypes: ScoreType[];
  years: AcademicYear[];
  terms: unknown[];
}

const STEPS = [
  { id: 1, title: "ព័ត៌មានសាលា", desc: "ឈ្មោះ អាសយដ្ឋាន និងនាយកសាលា", icon: Building2 },
  { id: 2, title: "ឆ្នាំសិក្សា", desc: "បង្កើតឆ្នាំសិក្សា និងឆមាស", icon: CalendarRange },
  { id: 3, title: "មុខវិជ្ជា", desc: "បន្ថែមមុខវិជ្ជាស្តង់ដារ ឬបង្កើតដោយខ្លួនឯង", icon: BookOpen },
  { id: 4, title: "ថ្នាក់ដំបូង", desc: "បង្កើតថ្នាក់ ដើម្បីចាប់ផ្ដើមបញ្ចូលសិស្ស", icon: School },
];

export default function SetupPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: meta } = useMeta();

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
  const now = new Date();
  const [year, setYear] = useState({
    name: `${now.getFullYear()}-${now.getFullYear() + 1}`,
    start_date: `${now.getFullYear()}-10-01`,
    end_date: `${now.getFullYear() + 1}-07-31`,
  });
  const [klass, setKlass] = useState({ name: "A", grade_level: "7", room: "" });

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
  }, [data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["meta"] });
  };

  const saveSchool = useMutation({
    mutationFn: () => api("/admin/settings", { method: "PUT", body: school }),
    onSuccess: () => {
      toast.success("បានរក្សាទុកព័ត៌មានសាលា");
      invalidate();
    },
    onError: (e: Error) => toast.error("រក្សាទុកមិនបានសម្រេច", e.message),
  });

  const createYear = useMutation({
    mutationFn: () => api("/admin/years", { method: "POST", body: year }),
    onSuccess: () => {
      toast.success("បានបង្កើតឆ្នាំសិក្សា", "បង្កើតឆមាសទី១ និងទី២ ដោយស្វ័យប្រវត្តិ");
      invalidate();
    },
    onError: (e: Error) => toast.error("បង្កើតមិនបានសម្រេច", e.message),
  });

  const addSubjects = useMutation({
    mutationFn: () => api<{ added: number }>("/admin/standard-subjects", { method: "POST" }),
    onSuccess: (res) => {
      toast.success("បានបន្ថែមមុខវិជ្ជា", `${res.added} មុខវិជ្ជាត្រូវបានបន្ថែម`);
      invalidate();
    },
    onError: (e: Error) => toast.error("បន្ថែមមិនបានសម្រេច", e.message),
  });

  const createClass = useMutation({
    mutationFn: () =>
      api("/classes", {
        method: "POST",
        body: {
          name: klass.name.trim(),
          grade_level: Number(klass.grade_level),
          room: klass.room || null,
          academic_year_id: meta?.settings.academic_year_id ?? data?.years.find((y) => y.is_current)?.id ?? data?.years[0]?.id,
        },
      }),
    onSuccess: () => {
      toast.success("បានបង្កើតថ្នាក់ដំបូង");
      setKlass({ ...klass, name: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error("បង្កើតមិនបានសម្រេច", e.message),
  });

  if (isLoading || !meta) return <PageLoader label="កំពុងរៀបចំប្រព័ន្ធ…" />;

  const hasSchool = !!data?.settings.school_name;
  const hasYear = (data?.years.length ?? 0) > 0;
  const hasSubjects = (meta.subjects.length ?? 0) > 0;
  const hasClass = (meta.classes.length ?? 0) > 0;
  const done = [hasSchool, hasYear, hasSubjects, hasClass];
  const completed = done.filter(Boolean).length;
  const canFinish = hasYear && hasSubjects && hasClass;

  return (
    <div className="mx-auto max-w-[1080px] space-y-5 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-ink-950 p-6 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 85% -20%, #3462f5 0, transparent 45%), radial-gradient(circle at 10% 120%, #14b8a6 0, transparent 45%)",
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-sky-300">
              <Sparkles size={12} /> ការរៀបចំប្រព័ន្ធដំបូង
            </p>
            <h2 className="mt-1 text-xl font-bold sm:text-2xl">សូមស្វាគមន៍មកកាន់ប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស</h2>
            <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-300">
              ប្រព័ន្ធនេះមិនមានទិន្នន័យគំរូទេ។ សូមបំពេញព័ត៌មានខាងក្រោម ដើម្បីចាប់ផ្ដើមប្រើប្រាស់ជាមួយទិន្នន័យពិតរបស់សាលាអ្នក។
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-ink-400">បានបញ្ចប់</p>
            <p className="text-lg font-bold">
              {completed}<span className="text-sm text-ink-400"> / 4</span>
            </p>
          </div>
        </div>
      </div>

      {/* Steps overview */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "card flex items-start gap-3 p-3.5",
              done[i] && "border-emerald-200 bg-emerald-50/40",
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                done[i] ? "bg-emerald-600 text-white" : "bg-ink-100 text-ink-500",
              )}
            >
              {done[i] ? <Check size={17} /> : <s.icon size={17} />}
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-ink-900">
                {i + 1}. {s.title}
              </p>
              <p className="text-[10.5px] leading-relaxed text-ink-500">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 1. School */}
      <section className="card p-4">
        <StepHeader
          index={1}
          done={hasSchool}
          icon={Building2}
          title="ព័ត៌មានសាលារៀន"
          desc="បង្ហាញនៅលើសៀវភៅពិន្ទុ សញ្ញាបត្រ និងរបាយការណ៍បោះពុម្ព"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="ឈ្មោះសាលា (ខ្មែរ)" required>
            <input
              className="input"
              value={school.school_name}
              onChange={(e) => setSchool({ ...school, school_name: e.target.value })}
              placeholder="ឧ. វិទ្យាល័យ…"
            />
          </Field>
          <Field label="ឈ្មោះសាលា (អង់គ្លេស)">
            <input
              className="input"
              value={school.school_name_en}
              onChange={(e) => setSchool({ ...school, school_name_en: e.target.value })}
              placeholder="High School"
            />
          </Field>
          <Field label="អាសយដ្ឋាន" className="sm:col-span-2">
            <input
              className="input"
              value={school.school_address}
              onChange={(e) => setSchool({ ...school, school_address: e.target.value })}
              placeholder="ភូមិ… ឃុំ… ក្រុង… ខេត្ត…"
            />
          </Field>
          <Field label="លេខទូរស័ព្ទ">
            <input
              className="input"
              value={school.school_phone}
              onChange={(e) => setSchool({ ...school, school_phone: e.target.value })}
              placeholder="012 345 678"
            />
          </Field>
          <Field label="អ៊ីមែលសាលា">
            <input
              className="input"
              value={school.school_email}
              onChange={(e) => setSchool({ ...school, school_email: e.target.value })}
              placeholder="school@gmail.com"
            />
          </Field>
          <Field label="ឈ្មោះនាយកសាលា">
            <input
              className="input"
              value={school.director_name}
              onChange={(e) => setSchool({ ...school, director_name: e.target.value })}
            />
          </Field>
          <Field label="ស្លោកសម្គាល់">
            <input
              className="input"
              value={school.motto}
              onChange={(e) => setSchool({ ...school, motto: e.target.value })}
              placeholder="ចំណេះដឹង គឺជាកម្លាំង"
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            className="btn-primary btn-sm"
            disabled={!school.school_name.trim() || saveSchool.isPending}
            onClick={() => saveSchool.mutate()}
          >
            {saveSchool.isPending ? <Spinner /> : <Check size={14} />} រក្សាទុកព័ត៌មានសាលា
          </button>
        </div>
      </section>

      {/* 2. Academic year */}
      <section className="card p-4">
        <StepHeader
          index={2}
          done={hasYear}
          icon={CalendarRange}
          title="ឆ្នាំសិក្សា និងឆមាស"
          desc="ត្រូវការយ៉ាងតិចមួយឆ្នាំសិក្សា ដើម្បីបញ្ចូលពិន្ទុ"
        />
        {hasYear ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 text-[12.5px] text-emerald-800">
            <CheckCircle2 size={15} />
            ឆ្នាំសិក្សា <b>{data?.years.find((y) => y.is_current)?.name ?? data?.years[0]?.name}</b>{" "}
            ត្រូវបានបង្កើតរួចហើយ (ឆមាសទី១ និងទី២)។
            <Link to="/settings" className="ml-auto font-medium underline">
              គ្រប់គ្រងឆ្នាំសិក្សា
            </Link>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="ឈ្មោះឆ្នាំសិក្សា" required hint="ឧ. 2026-2027">
              <input className="input" value={year.name} onChange={(e) => setYear({ ...year, name: e.target.value })} />
            </Field>
            <Field label="ថ្ងៃចាប់ផ្ដើម">
              <input
                type="date"
                className="input"
                value={year.start_date}
                onChange={(e) => setYear({ ...year, start_date: e.target.value })}
              />
            </Field>
            <Field label="ថ្ងៃបញ្ចប់">
              <input
                type="date"
                className="input"
                value={year.end_date}
                onChange={(e) => setYear({ ...year, end_date: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-3 flex justify-end">
              <button
                className="btn-primary btn-sm"
                disabled={!year.name.trim() || createYear.isPending}
                onClick={() => createYear.mutate()}
              >
                {createYear.isPending ? <Spinner /> : <CalendarRange size={14} />} បង្កើតឆ្នាំសិក្សា
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3. Subjects */}
      <section className="card p-4">
        <StepHeader
          index={3}
          done={hasSubjects}
          icon={BookOpen}
          title="មុខវិជ្ជាសិក្សា"
          desc="ប្រើបញ្ជីមុខវិជ្ជាស្តង់ដារ ឬបង្កើតដោយខ្លួនឯងនៅទំព័រមុខវិជ្ជា"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-ink-200 bg-ink-50/60 px-3.5 py-2.5 text-[12.5px] text-ink-700">
            មុខវិជ្ជាបច្ចុប្បន្ន: <b>{meta.subjects.length}</b>
          </div>
          <button
            className="btn-secondary btn-sm"
            disabled={addSubjects.isPending}
            onClick={() => addSubjects.mutate()}
          >
            {addSubjects.isPending ? <Spinner /> : <Sparkles size={14} />} បន្ថែមមុខវិជ្ជាស្តង់ដារ ១២
          </button>
          <Link to="/subjects" className="btn-ghost btn-sm">
            គ្រប់គ្រងមុខវិជ្ជាដោយខ្លួនឯង <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      {/* 4. First class */}
      <section className="card p-4">
        <StepHeader
          index={4}
          done={hasClass}
          icon={School}
          title="ថ្នាក់រៀនដំបូង"
          desc="បង្កើតថ្នាក់ ដើម្បីចាប់ផ្ដើមបន្ថែមសិស្ស និងចាត់តាំងគ្រូ"
        />
        {hasClass ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 text-[12.5px] text-emerald-800">
            <CheckCircle2 size={15} />
            មានថ្នាក់រៀន <b>{meta.classes.length}</b> រួចហើយ។
            <Link to="/classes" className="ml-auto font-medium underline">
              គ្រប់គ្រងថ្នាក់រៀន
            </Link>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Field label="កម្រិតសិក្សា">
              <select
                className="input"
                value={klass.grade_level}
                onChange={(e) => setKlass({ ...klass, grade_level: e.target.value })}
              >
                {[7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={g}>
                    ថ្នាក់ទី {g}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ឈ្មោះថ្នាក់" required hint="ឧ. A ឬ 7A">
              <input className="input" value={klass.name} onChange={(e) => setKlass({ ...klass, name: e.target.value })} />
            </Field>
            <Field label="បន្ទប់">
              <input className="input" value={klass.room} onChange={(e) => setKlass({ ...klass, room: e.target.value })} />
            </Field>
            <div className="flex items-end">
              <button
                className="btn-primary btn-sm w-full"
                disabled={!klass.name.trim() || !hasYear || createClass.isPending}
                onClick={() => createClass.mutate()}
              >
                {createClass.isPending ? <Spinner /> : <School size={14} />} បង្កើតថ្នាក់
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Finish */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-start gap-2.5">
          <Info size={16} className="mt-0.5 shrink-0 text-brand-500" />
          <p className="text-[12px] leading-relaxed text-ink-600">
            បន្ទាប់ពីបញ្ចប់ អ្នកអាចបន្ថែមសិស្ស ចាត់តាំងគ្រូ បញ្ចូលពិន្ទុ និងកត់ត្រាវត្តមានបាន។
            អ្នកអាចត្រឡប់មកទំព័រនេះវិញបានគ្រប់ពេលតាមការកំណត់។
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => navigate("/dashboard")}>
            រំលងឥឡូវ
          </button>
          <button className="btn-primary btn-sm" disabled={!canFinish} onClick={() => navigate("/dashboard")}>
            <GraduationCap size={14} /> ចាប់ផ្ដើមប្រើប្រាស់
          </button>
        </div>
      </div>

      <p className="pb-4 text-center text-[11px] text-ink-400">
        រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ <span className="font-semibold text-ink-500">វណ្ណា វណ្ណឆៃ</span>
      </p>
    </div>
  );
}

function StepHeader({
  index,
  done,
  icon: Icon,
  title,
  desc,
}: {
  index: number;
  done: boolean;
  icon: typeof Building2;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          done ? "bg-emerald-600 text-white" : "bg-brand-50 text-brand-600",
        )}
      >
        {done ? <Check size={17} /> : <Icon size={17} />}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-ink-900">
          {index}. {title}
        </h3>
        <p className="text-[11.5px] text-ink-500">{desc}</p>
      </div>
    </div>
  );
}
