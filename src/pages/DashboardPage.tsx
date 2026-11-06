import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  CalendarCheck2,
  GraduationCap,
  Percent,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import { useAuth } from "../lib/auth";
import { Avatar, EmptyState, GradeBadge, PageLoader, SectionCard, StatCard } from "../components/ui";
import { cn, formatDate, formatNumber } from "../lib/utils";
import type { GradeInfo, StudentResult, Term } from "../lib/types";

interface DashboardData {
  counts: {
    students: number;
    males: number;
    females: number;
    classes: number;
    subjects: number;
    teachers: number;
    totalStudents: number;
  };
  overallAverage: number | null;
  passRate: number | null;
  bands: (GradeInfo & { label: string; count: number })[];
  subjectPerformance: { id: number; code: string; name_kh: string; color: string; average: number | null; score_count: number }[];
  classResults: { class_id: number; name: string; grade_level: number; students: number; average: number | null; pass_rate: number | null; highest: number | null }[];
  trend: { term_id: number; label: string; year: string; average: number | null }[];
  topStudents: (StudentResult & { school_rank: number })[];
  attendance: { rate: number | null; present: number; absent: number; late: number; permission: number; total: number };
  recentScores: { at: string; user_name: string | null; subject: string; class_name: string; type_name: string; count: number }[];
  recentLogs: { id: number; user_name: string; action: string; detail: string; created_at: string }[];
  attention: StudentResult[];
  termId: number;
  term: Term | null;
  month: string;
}

const BAND_COLORS = ["#10b981", "#0ea5e9", "#6366f1", "#f59e0b", "#f97316", "#f43f5e"];

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const [termId, setTermId] = useState<number | null>(null);
  const activeTerm = termId ?? meta?.settings.term_id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", activeTerm],
    queryFn: () => api<DashboardData>("/dashboard", { query: { term_id: activeTerm } }),
    enabled: !!meta,
  });

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "អរុណសួស្តី";
    if (h < 17) return "ទិវាសួស្តី";
    return "សាយណ្ហសួស្តី";
  }, []);

  if (isLoading || !data) return <PageLoader label="កំពុងប្រមូលទិន្នន័យសិក្សា…" />;

  const trendData = data.trend.map((t) => ({ ...t, label: `${t.label} ${t.year.slice(0, 4)}` }));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-ink-950 p-5 text-white sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 85% -10%, #3462f5 0, transparent 45%), radial-gradient(circle at 15% 120%, #0ea5e9 0, transparent 45%)",
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-sky-300">
              {greeting} · {formatDate(new Date().toISOString())}
            </p>
            <h2 className="mt-1 text-xl font-bold sm:text-2xl">{user?.name}</h2>
            <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-ink-300">
              ទិដ្ឋភាពរួមនៃលទ្ធផលសិក្សា — {data.term ? `${data.term.name}` : "គ្មានឆមាស"}{" "}
              {meta?.years.find((y) => y.id === data.term?.academic_year_id)?.name ?? ""}។
              ទិន្នន័យត្រូវបានគណនាស្វ័យប្រវត្តិពីពិន្ទុដែលបានបញ្ចូល។
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="text-[10px] font-medium uppercase tracking-wider text-ink-400">
              ជ្រើសរើសឆមាស
            </label>
            <select
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white outline-none backdrop-blur focus:border-white/30"
              value={activeTerm ?? ""}
              onChange={(e) => setTermId(Number(e.target.value))}
            >
              {meta?.terms.map((t) => (
                <option key={t.id} value={t.id} className="text-ink-900">
                  {t.name} · {meta.years.find((y) => y.id === t.academic_year_id)?.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="សិស្សកំពុងសិក្សា"
          value={data.counts.students}
          icon={Users}
          tone="brand"
          hint={`ប្រុស ${data.counts.males} · ស្រី ${data.counts.females}`}
        />
        <StatCard
          label="មធ្យមភាគសាលា"
          value={data.overallAverage !== null ? formatNumber(data.overallAverage) : "—"}
          icon={TrendingUp}
          tone="emerald"
          hint="គិតលើគ្រប់ថ្នាក់ និងមុខវិជ្ជា"
        />
        <StatCard
          label="អត្រាជាប់"
          value={data.passRate !== null ? `${data.passRate}%` : "—"}
          icon={Percent}
          tone="violet"
          hint={`កំណត់ជាប់ត្រូវការ ≥ ${meta?.settings.pass_mark ?? 50} ពិន្ទុ`}
        />
        <StatCard
          label="វត្តមានខែនេះ"
          value={data.attendance.rate !== null ? `${data.attendance.rate}%` : "—"}
          icon={CalendarCheck2}
          tone="sky"
          hint={`អវត្តមាន ${data.attendance.absent ?? 0} · យឺត ${data.attendance.late ?? 0}`}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="និន្នាការមធ្យមភាគតាមឆមាស"
          subtitle="មធ្យមភាគរួមនៃសាលាតាមលំដាប់ឆមាស"
          className="xl:col-span-2"
          bodyClassName="p-3 pt-5"
        >
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3462f5" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3462f5" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8993b6" }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#8993b6" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e9f2", fontSize: 12, fontFamily: "inherit" }}
                  formatter={(v: number) => [`${v} ពិន្ទុ`, "មធ្យមភាគ"]}
                />
                <Area
                  type="monotone"
                  dataKey="average"
                  stroke="#3462f5"
                  strokeWidth={2.5}
                  fill="url(#avgFill)"
                  dot={{ r: 3.5, fill: "#fff", strokeWidth: 2.5, stroke: "#3462f5" }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="ការបែងចែកនិទ្ទេស" subtitle={`សិស្ស ${data.counts.students} នាក់`} bodyClassName="p-4">
          <div className="space-y-3">
            {data.bands.map((band, i) => {
              const max = Math.max(1, ...data.bands.map((b) => b.count));
              return (
                <div key={band.grade}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white"
                        style={{ background: BAND_COLORS[i % BAND_COLORS.length] }}
                      >
                        {band.grade}
                      </span>
                      <span className="text-ink-600">{band.label}</span>
                    </span>
                    <span className="font-semibold text-ink-800">{band.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(band.count / max) * 100}%`,
                        background: BAND_COLORS[i % BAND_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="មធ្យមភាគតាមមុខវិជ្ជា"
          subtitle="ផ្អែកលើពិន្ទុទាំងអស់ក្នុងឆមាសនេះ"
          bodyClassName="p-3 pt-4"
        >
          {data.subjectPerformance.length === 0 ? (
            <EmptyState title="មិនទាន់មានពិន្ទុ" description="បញ្ចូលពិន្ទុដើម្បីមើលការវិភាគមុខវិជ្ជា" />
          ) : (
            <div style={{ height: Math.max(220, data.subjectPerformance.length * 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.subjectPerformance}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#8993b6" }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name_kh"
                    width={118}
                    tick={{ fontSize: 10.5, fill: "#545d7e" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e9f2", fontSize: 12 }}
                    formatter={(v: number) => [`${v} ពិន្ទុ`, "មធ្យមភាគ"]}
                  />
                  <Bar dataKey="average" radius={[0, 6, 6, 0]} barSize={13}>
                    {data.subjectPerformance.map((s) => (
                      <Cell key={s.id} fill={s.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="លទ្ធផលតាមថ្នាក់"
          subtitle={`ថ្នាក់សកម្ម ${data.classResults.length} · គ្រូ ${data.counts.teachers} នាក់`}
          actions={
            <Link to="/results" className="text-[11px] font-medium text-brand-600 hover:underline">
              មើលលម្អិត
            </Link>
          }
          bodyClassName="max-h-[360px] overflow-auto"
        >
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="th">ថ្នាក់</th>
                <th className="th text-center">សិស្ស</th>
                <th className="th text-center">មធ្យមភាគ</th>
                <th className="th text-center">អត្រាជាប់</th>
              </tr>
            </thead>
            <tbody>
              {data.classResults.map((c) => (
                <tr key={c.class_id} className="table-row">
                  <td className="td font-medium text-ink-900">
                    <Link to={`/results?class_id=${c.class_id}`} className="hover:text-brand-600">
                      ថ្នាក់ទី{c.grade_level}
                      {c.name}
                    </Link>
                  </td>
                  <td className="td text-center">{c.students}</td>
                  <td className="td text-center">
                    <span className={cn("font-semibold", (c.average ?? 0) >= 50 ? "text-ink-900" : "text-rose-600")}>
                      {formatNumber(c.average)}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${c.pass_rate ?? 0}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-[11px] text-ink-500">{c.pass_rate ?? 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="សិស្សឆ្នើម"
          subtitle="ចំណាត់ថ្នាក់ល្អបំផុតក្នុងសាលា"
          actions={<Award size={15} className="text-amber-500" />}
          bodyClassName="divide-y divide-ink-100"
        >
          {data.topStudents.length === 0 ? (
            <EmptyState title="មិនទាន់មានទិន្នន័យ" />
          ) : (
            data.topStudents.map((s, i) => (
              <Link
                key={s.student_id}
                to={`/students/${s.student_id}`}
                className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-brand-50/40"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
                    i === 0
                      ? "bg-amber-100 text-amber-700"
                      : i === 1
                        ? "bg-ink-200 text-ink-700"
                        : i === 2
                          ? "bg-orange-100 text-orange-700"
                          : "bg-ink-50 text-ink-500",
                  )}
                >
                  {i + 1}
                </span>
                <Avatar name={s.name_kh} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink-900">{s.name_kh}</p>
                  <p className="text-[11px] text-ink-500">ថ្នាក់ {s.class_name}</p>
                </div>
                <span className="text-[13px] font-semibold text-brand-700">{formatNumber(s.average)}</span>
                <GradeBadge grade={s.grade} />
              </Link>
            ))
          )}
        </SectionCard>

        <SectionCard
          title="ត្រូវការយកចិត្តទុកដាក់"
          subtitle="សិស្សដែលមានមធ្យមភាគទាប"
          actions={<AlertTriangle size={15} className="text-rose-500" />}
          bodyClassName="divide-y divide-ink-100"
        >
          {data.attention.length === 0 ? (
            <EmptyState title="គ្មានសិស្សធ្លាក់" description="សិស្សទាំងអស់មានលទ្ធផលល្អ" />
          ) : (
            data.attention.map((s) => (
              <Link
                key={s.student_id}
                to={`/students/${s.student_id}`}
                className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-rose-50/50"
              >
                <Avatar name={s.name_kh} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink-900">{s.name_kh}</p>
                  <p className="text-[11px] text-ink-500">ថ្នាក់ {s.class_name}</p>
                </div>
                <span className="text-[13px] font-semibold text-rose-600">{formatNumber(s.average)}</span>
              </Link>
            ))
          )}
        </SectionCard>

        <SectionCard
          title="សកម្មភាពថ្មីៗ"
          subtitle="កំណត់ត្រាការងារចុងក្រោយ"
          bodyClassName="divide-y divide-ink-100"
        >
          {data.recentLogs.length === 0 ? (
            <EmptyState title="គ្មានសកម្មភាព" />
          ) : (
            data.recentLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="flex gap-3 px-4 py-2.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <UserRound size={12} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] text-ink-700">{log.detail}</p>
                  <p className="mt-0.5 text-[10.5px] text-ink-400">
                    {log.user_name} · {formatDate(log.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink to="/scores" icon={GraduationCap} title="បញ្ចូលពិន្ទុ" desc="កត់ត្រាពិន្ទុតាមថ្នាក់ និងមុខវិជ្ជា" />
        <QuickLink to="/attendance" icon={CalendarCheck2} title="កត់ត្រាវត្តមាន" desc="កត់ត្រាវត្តមានប្រចាំថ្ងៃ" />
        <QuickLink to="/results" icon={Percent} title="របាយការណ៍លទ្ធផល" desc="មើលចំណាត់ថ្នាក់ និងបោះពុម្ព" />
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink-900">{title}</p>
        <p className="truncate text-[11px] text-ink-500">{desc}</p>
      </div>
      <ArrowUpRight size={16} className="text-ink-300 transition group-hover:text-brand-500" />
    </Link>
  );
}
