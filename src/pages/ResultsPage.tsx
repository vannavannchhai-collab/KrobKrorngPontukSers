import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Award,
  BarChart3,
  Download,
  FileText,
  Percent,
  Printer,
  Trophy,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, download } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import type { ClassResultResponse } from "../lib/types";
import { EmptyState, GradeBadge, PageLoader, SectionCard, StatCard, Avatar } from "../components/ui";
import { cn, formatDate, formatNumber, scoreTone } from "../lib/utils";

export default function ResultsPage() {
  const { data: meta } = useMeta();
  const [params, setParams] = useSearchParams();
  const [classId, setClassId] = useState<number | null>(null);
  const [termId, setTermId] = useState<number | null>(null);

  useEffect(() => {
    if (!meta) return;
    const fromUrl = Number(params.get("class_id"));
    setClassId((c) => c ?? (fromUrl || meta.classes[0]?.id) ?? null);
    setTermId((t) => t ?? meta.settings.term_id);
  }, [meta, params]);

  const { data, isLoading } = useQuery({
    queryKey: ["results", classId, termId],
    queryFn: () =>
      api<ClassResultResponse>("/results/class", {
        query: { class_id: classId, term_id: termId },
      }),
    enabled: !!classId && !!termId,
  });

  useEffect(() => {
    if (classId && params.get("class_id") !== String(classId)) {
      const next = new URLSearchParams(params);
      next.set("class_id", String(classId));
      setParams(next, { replace: true });
    }
  }, [classId, params, setParams]);

  const defaulters = useMemo(
    () => data?.students.filter((s) => s.passed === false) ?? [],
    [data],
  );

  if (isLoading || !data) return <PageLoader label="កំពុងគណនាលទ្ធផល…" />;

  const exportCsv = () =>
    download(`/results/export/csv?class_id=${classId}&term_id=${termId}`, `results-${data.class.name}-${termId}.csv`);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Print header */}
      <div className="hidden print:block">
        <div className="text-center">
          <p className="text-[13px] font-bold">ព្រះរាជាណាចក្រកម្ពុជា</p>
          <p className="text-[12px] font-semibold">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
          <div className="mx-auto my-1.5 w-24 border-t border-black" />
          <p className="text-[14px] font-bold">{meta?.settings.school_name}</p>
          <p className="mt-1 text-[13px] font-semibold underline">
            បញ្ជីលទ្ធផលសិក្សាថ្នាក់ទី{data.class.grade_level}
            {data.class.name}
          </p>
          <p className="text-[12px]">
            {data.term.name} · ឆ្នាំសិក្សា{" "}
            {meta?.years.find((y) => y.id === data.term.academic_year_id)?.name} · ធ្វើនៅ {formatDate(new Date().toISOString())}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 no-print">
        <div className="min-w-[150px] flex-1">
          <label className="label">ថ្នាក់រៀន</label>
          <select className="input" value={classId ?? ""} onChange={(e) => setClassId(Number(e.target.value))}>
            {meta?.classes.map((c) => (
              <option key={c.id} value={c.id}>
                ថ្នាក់ទី{c.grade_level}
                {c.name} — {c.student_count ?? 0} នាក់
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="label">ឆមាសសិក្សា</label>
          <select className="input" value={termId ?? ""} onChange={(e) => setTermId(Number(e.target.value))}>
            {meta?.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {meta.years.find((y) => y.id === t.academic_year_id)?.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pb-0.5">
          <button className="btn-secondary btn-sm" onClick={exportCsv}>
            <Download size={14} /> នាំចេញ CSV
          </button>
          <button className="btn-primary btn-sm" onClick={() => window.print()}>
            <Printer size={14} /> បោះពុម្ព
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 no-print">
        <StatCard
          label="មធ្យមភាគថ្នាក់"
          value={formatNumber(data.stats.average)}
          icon={BarChart3}
          tone="brand"
          hint={`សិស្ស ${data.stats.count} នាក់ · មានពិន្ទុ ${data.stats.graded}`}
        />
        <StatCard
          label="អត្រាជាប់"
          value={data.stats.passRate !== null ? `${data.stats.passRate}%` : "—"}
          icon={Percent}
          tone="emerald"
          hint={`ជាប់ ${data.stats.passed} · ធ្លាក់ ${data.stats.failed}`}
        />
        <StatCard label="ខ្ពស់បំផុត" value={formatNumber(data.stats.highest)} icon={TrendingUp} tone="sky" hint="មធ្យមភាគខ្ពស់បំផុត" />
        <StatCard label="ទាបបំផុត" value={formatNumber(data.stats.lowest)} icon={TrendingDown} tone="rose" hint="មធ្យមភាគទាបបំផុត" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3 no-print">
        <SectionCard
          title="មធ្យមភាគតាមមុខវិជ្ជា"
          subtitle="សម្រាប់ថ្នាក់ដែលបានជ្រើសរើស"
          className="xl:col-span-2"
          bodyClassName="p-3 pt-4"
        >
          {data.subjectAverages.length === 0 ? (
            <EmptyState title="មិនទាន់មានមុខវិជ្ជា" />
          ) : (
            <div style={{ height: Math.max(200, data.subjectAverages.length * 26) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.subjectAverages} layout="vertical" margin={{ top: 0, right: 20, left: 6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#8993b6" }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 10.5, fill: "#545d7e" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e9f2", fontSize: 12 }} />
                  <Bar dataKey="average" fill="#3462f5" radius={[0, 6, 6, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="សិស្សឆ្នើមប្រចាំថ្នាក់" subtitle="តាមមធ្យមភាគ" bodyClassName="divide-y divide-ink-100">
          {data.students.filter((s) => s.average !== null).slice(0, 5).map((s, i) => (
            <div key={s.student_id} className="flex items-center gap-2.5 px-4 py-2.5">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold",
                  i === 0 ? "bg-amber-100 text-amber-700" : "bg-ink-100 text-ink-500",
                )}
              >
                {i + 1}
              </span>
              <Avatar name={s.name_kh} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ink-800">{s.name_kh}</p>
              </div>
              <span className="text-[12.5px] font-semibold text-ink-900">{formatNumber(s.average)}</span>
              <GradeBadge grade={s.grade} />
            </div>
          ))}
        </SectionCard>
      </div>

      <section className="card overflow-hidden print-area">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-ink-900">
              តារាងលទ្ធផលពេញលេញ — ថ្នាក់ទី{data.class.grade_level}
              {data.class.name}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-ink-500">
            <span>គ្រូបន្ទុកថ្នាក់: {data.homeroom ?? "—"}</span>
            <span>·</span>
            <span>{data.term.name}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-ink-50/70">
              <tr>
                <th className="th w-12 text-center">ចំ.</th>
                <th className="th">ឈ្មោះសិស្ស</th>
                <th className="th text-center">ភេទ</th>
                {data.subjects.map((s) => (
                  <th key={s.id} className="th text-center" title={s.name_kh}>
                    {s.code}
                  </th>
                ))}
                <th className="th text-center">សរុប</th>
                <th className="th text-center">មធ្យមភាគ</th>
                <th className="th text-center">និទ្ទេស</th>
                <th className="th text-center no-print">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {data.students.length === 0 ? (
                <tr>
                  <td colSpan={data.subjects.length + 7}>
                    <EmptyState title="ថ្នាក់នេះគ្មានសិស្ស" />
                  </td>
                </tr>
              ) : (
                data.students.map((s, i) => (
                  <tr key={s.student_id} className={cn("table-row", i % 2 === 1 && "bg-ink-50/30")}>
                    <td className="td text-center font-semibold text-ink-500">{s.rank ?? "—"}</td>
                    <td className="td">
                      <Link to={`/students/${s.student_id}`} className="flex items-center gap-2 hover:text-brand-600">
                        <Avatar name={s.name_kh} size={26} />
                        <span className="font-medium text-ink-900">{s.name_kh}</span>
                      </Link>
                      <span className="ml-8 text-[10.5px] text-ink-400">{s.code}</span>
                    </td>
                    <td className="td text-center text-[11.5px]">{s.gender === "M" ? "ប្រុស" : "ស្រី"}</td>
                    {s.subjects.map((sub) => (
                      <td key={sub.subject_id} className={cn("td text-center", scoreTone(sub.average, data.passMark))}>
                        {sub.average === null ? "—" : formatNumber(sub.average, 1)}
                      </td>
                    ))}
                    <td className="td text-center font-medium text-ink-700">{formatNumber(s.total, 1)}</td>
                    <td className="td text-center text-[13px] font-bold text-ink-900">{formatNumber(s.average)}</td>
                    <td className="td text-center">
                      <GradeBadge grade={s.grade} />
                    </td>
                    <td className="td text-center no-print">
                      <Link
                        to={`/report-card/${s.student_id}?term_id=${termId}`}
                        className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-600 hover:underline"
                      >
                        <FileText size={12} /> សៀវភៅពិន្ទុ
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.subjectAverages.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-ink-200 bg-ink-50/60">
                  <td className="td" />
                  <td className="td font-semibold text-ink-900">មធ្យមភាគថ្នាក់</td>
                  <td className="td" />
                  {data.subjectAverages.map((s) => (
                    <td key={s.subject_id} className="td text-center font-semibold text-brand-700">
                      {formatNumber(s.average, 1)}
                    </td>
                  ))}
                  <td className="td" />
                  <td className="td text-center font-bold text-brand-700">{formatNumber(data.stats.average)}</td>
                  <td className="td" />
                  <td className="td no-print" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-2.5 text-[11.5px] text-ink-500">
          <span>
            សិស្សសរុប {data.stats.count} នាក់ · ប្រុស {data.stats.males} · ស្រី {data.stats.females} · ជាប់{" "}
            {data.stats.passed} · ធ្លាក់ {data.stats.failed}
          </span>
          <span>
            កំណត់ជាប់ ≥ {data.passMark} ពិន្ទុ · {defaulters.length > 0 ? `សិស្សត្រូវការយកចិត្តទុកដាក់ ${defaulters.length} នាក់` : "គ្មានសិស្សធ្លាក់"}
          </span>
        </div>
      </section>

      {defaulters.length > 0 ? (
        <SectionCard
          title="សិស្សត្រូវការជំនួយបន្ថែម"
          subtitle="មធ្យមភាគក្រោមកម្រិតជាប់"
          actions={<Award size={15} className="text-rose-500" />}
          bodyClassName="divide-y divide-ink-100 no-print"
        >
          {defaulters.map((s) => (
            <div key={s.student_id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <Avatar name={s.name_kh} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-ink-800">{s.name_kh}</p>
                <p className="text-[11px] text-ink-400">ចំណាត់ថ្នាក់ទី {s.rank ?? "—"}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.subjects
                  .filter((x) => x.average !== null && x.average < data.passMark)
                  .map((x) => (
                    <span key={x.subject_id} className="badge bg-rose-50 text-rose-600">
                      {x.subject_name} {formatNumber(x.average, 1)}
                    </span>
                  ))}
              </div>
              <Link to={`/students/${s.student_id}`} className="btn-secondary btn-sm">
                មើលលម្អិត
              </Link>
            </div>
          ))}
        </SectionCard>
      ) : null}

      <div className="hidden print:block mt-10 text-[12px]">
        <div className="flex justify-between px-8">
          <div className="text-center">
            <p>បានឃើញ និងឯកភាព</p>
            <p className="mt-1 font-semibold">នាយកសាលា</p>
            <div className="h-16" />
            <p className="border-t border-black px-8 pt-1">{meta?.settings.director_name}</p>
          </div>
          <div className="text-center">
            <p>គ្រូបន្ទុកថ្នាក់</p>
            <div className="h-16" />
            <p className="border-t border-black px-8 pt-1">{data.homeroom ?? "................"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
