import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarDays,
  FileText,
  GraduationCap,
  Home,
  MapPin,
  Pencil,
  Phone,
  Printer,
  UserRound,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import { useSession } from "../lib/session";
import type { Student, StudentResult, Term } from "../lib/types";
import { Avatar, EmptyState, GradeBadge, PageLoader, SectionCard, StatCard, StatusBadge } from "../components/ui";
import { StudentFormModal } from "../components/StudentFormModal";
import {
  cn,
  formatDate,
  formatNumber,
  formatScore,
  genderLabel,
  scoreTone,
  statusLabel,
} from "../lib/utils";

interface DetailResponse {
  student: Student;
  result: StudentResult | null;
  history: {
    term_id: number;
    term_name: string;
    semester: number;
    average: number | null;
    rank: number | null;
    grade: string | null;
    passed: boolean | null;
    subject_count: number;
  }[];
  attendance: { present: number; absent: number; late: number; permission: number } | null;
  classSize: number;
  className: string | null;
  homeroom: string | null;
}

export default function StudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: meta } = useMeta();
  const [termId, setTermId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const activeTerm = termId ?? meta?.settings.term_id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["student", id, activeTerm],
    queryFn: () => api<DetailResponse>(`/students/${id}`, { query: { term_id: activeTerm } }),
    enabled: !!id && !!meta,
  });

  if (isLoading || !data) return <PageLoader label="កំពុងផ្ទុកព័ត៌មានសិស្ស…" />;

  const { student, result, history, attendance } = data;
  const attTotal = attendance
    ? attendance.present + attendance.absent + attendance.late + attendance.permission
    : 0;
  const attRate = attTotal ? Math.round(((attendance!.present + attendance!.late) / attTotal) * 1000) / 10 : null;
  const term = meta?.terms.find((t) => t.id === activeTerm) as Term | undefined;

  const chartData = history
    .filter((h) => h.average !== null)
    .map((h) => ({ label: `${h.term_name.replace("ឆមាសទី", "ឆ.")}`, average: h.average, rank: h.rank }));

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary btn-sm" onClick={() => navigate("/students")}>
          <ArrowLeft size={14} /> ត្រឡប់ទៅបញ្ជីសិស្ស
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link to={`/report-card/${student.id}?term_id=${activeTerm ?? ""}`} className="btn-secondary btn-sm">
            <Printer size={14} /> សៀវភៅពិន្ទុ
          </Link>
          <Link to={`/transcript/${student.id}`} className="btn-secondary btn-sm">
            <FileText size={14} /> សញ្ញាបត្រ
          </Link>
          {user?.role === "admin" ? (
            <button className="btn-primary btn-sm" onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> កែប្រែព័ត៌មាន
            </button>
          ) : null}
        </div>
      </div>

      {/* Profile */}
      <div className="card overflow-hidden">
        <div className="relative h-24 bg-ink-950">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 0%, #3462f5 0, transparent 45%), radial-gradient(circle at 85% 40%, #0ea5e9 0, transparent 40%)",
            }}
          />
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-9 flex flex-wrap items-end gap-4">
            <div className="rounded-2xl border-4 border-white bg-white shadow-sm">
              <Avatar name={student.name_kh} size={72} className="!rounded-xl" />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h2 className="text-lg font-bold text-ink-950">{student.name_kh}</h2>
              <p className="text-xs text-ink-500">
                {[student.first_name_en, student.last_name_en].filter(Boolean).join(" ") || "—"} · {student.code}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <StatusBadge status={student.status} />
              {student.class_name ? (
                <span className="badge bg-brand-50 text-brand-700">
                  <GraduationCap size={12} /> ថ្នាក់ទី{student.grade_level}
                  {student.class_name}
                </span>
              ) : null}
              {data.homeroom ? (
                <span className="badge bg-ink-100 text-ink-600">គ្រូបន្ទុកថ្នាក់: {data.homeroom}</span>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-x-6 gap-y-3 border-t border-ink-100 pt-4 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow icon={UserRound} label="ភេទ" value={genderLabel(student.gender)} />
            <InfoRow icon={CalendarDays} label="ថ្ងៃកំណើត" value={formatDate(student.dob)} />
            <InfoRow icon={Phone} label="ទូរស័ព្ទ" value={student.phone ?? "—"} />
            <InfoRow icon={CalendarCheck2} label="ចុះឈ្មោះ" value={formatDate(student.enroll_date)} />
            <InfoRow icon={UserRound} label="អ្នកអភិបាល" value={student.guardian_name ?? "—"} />
            <InfoRow icon={Phone} label="ទូរស័ព្ទអ្នកអភិបាល" value={student.guardian_phone ?? "—"} />
            <InfoRow icon={MapPin} label="អាសយដ្ឋាន" value={student.address ?? "—"} className="sm:col-span-2" />
            {student.note ? <InfoRow icon={Home} label="កំណត់សម្គាល់" value={student.note} className="sm:col-span-2" /> : null}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="មធ្យមភាគ" value={formatNumber(result?.average)} icon={GraduationCap} tone="brand" hint={term?.name ?? "—"} />
        <StatCard
          label="ចំណាត់ថ្នាក់ក្នុងថ្នាក់"
          value={result?.rank ? `ទី ${result.rank}` : "—"}
          icon={UserRound}
          tone="violet"
          hint={`ក្នុងចំណោម ${data.classSize} នាក់`}
        />
        <StatCard
          label="និទ្ទេស"
          value={result?.grade ?? "—"}
          icon={FileText}
          tone="emerald"
          hint={result?.remark ?? "មិនទាន់មានពិន្ទុ"}
        />
        <StatCard
          label="អត្រាវត្តមាន"
          value={attRate !== null ? `${attRate}%` : "—"}
          icon={CalendarCheck2}
          tone="sky"
          hint={attendance ? `អវត្តមាន ${attendance.absent} · យឺត ${attendance.late}` : "គ្មានទិន្នន័យ"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">លទ្ធផលសិក្សាសម្រាប់៖</span>
        <select
          className="input w-auto py-1.5 text-xs"
          value={activeTerm ?? ""}
          onChange={(e) => setTermId(Number(e.target.value))}
        >
          {meta?.terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {meta.years.find((y) => y.id === t.academic_year_id)?.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="លទ្ធផលតាមមុខវិជ្ជា"
          subtitle={result ? `${result.subjects.filter((s) => s.average !== null).length} មុខវិជ្ជាមានពិន្ទុ` : "មិនទាន់មានពិន្ទុ"}
          className="xl:col-span-2"
          bodyClassName="overflow-x-auto"
        >
          {!result || result.subjects.every((s) => s.average === null) ? (
            <EmptyState
              icon={GraduationCap}
              title="មិនទាន់មានពិន្ទុសម្រាប់ឆមាសនេះ"
              description="សូមជ្រើសរើសឆមាសផ្សេង ឬបញ្ចូលពិន្ទុជាមុន"
            />
          ) : (
            <table className="w-full min-w-[460px]">
              <thead className="bg-ink-50/70">
                <tr>
                  <th className="th">មុខវិជ្ជា</th>
                  <th className="th text-center">ពិន្ទុ</th>
                  <th className="th text-center">មធ្យមភាគ</th>
                  <th className="th text-center">ការវាយតម្លៃ</th>
                </tr>
              </thead>
              <tbody>
                {result.subjects.map((sub) => (
                  <tr key={sub.subject_id} className="table-row">
                    <td className="td font-medium text-ink-800">{sub.subject_name}</td>
                    <td className="td text-center text-[11.5px] text-ink-500">
                      {Object.entries(sub.scores)
                        .filter(([, v]) => v !== null)
                        .map(([k, v]) => {
                          const type = meta?.scoreTypes.find((t) => t.code === k);
                          return `${type?.name_kh ?? k}: ${formatScore(v)}`;
                        })
                        .join(" · ") || "—"}
                    </td>
                    <td className={cn("td text-center font-semibold", scoreTone(sub.average))}>
                      {formatNumber(sub.average)}
                    </td>
                    <td className="td text-center">
                      <GradeBadge grade={gradeOf(sub.average, meta?.gradeScale ?? [])} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-200 bg-ink-50/60">
                  <td className="td font-semibold text-ink-900">សរុប / មធ្យមភាគ</td>
                  <td className="td text-center text-ink-600">{formatNumber(result.total)}</td>
                  <td className="td text-center text-[15px] font-bold text-brand-700">{formatNumber(result.average)}</td>
                  <td className="td text-center">
                    <GradeBadge grade={result.grade} />
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="និន្នាការលទ្ធផល" subtitle="មធ្យមភាគតាមឆមាស" bodyClassName="p-3 pt-4">
            {chartData.length === 0 ? (
              <EmptyState title="គ្មានទិន្នន័យ" />
            ) : (
              <div className="h-[190px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="stuFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8993b6" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#8993b6" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e9f2", fontSize: 12 }} />
                    <Area type="monotone" dataKey="average" stroke="#10b981" strokeWidth={2.5} fill="url(#stuFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <SectionCard title="ប្រវត្តិលទ្ធផល" bodyClassName="divide-y divide-ink-100">
            {history.filter((h) => h.average !== null).length === 0 ? (
              <EmptyState title="គ្មានប្រវត្តិ" />
            ) : (
              history
                .filter((h) => h.average !== null)
                .map((h) => (
                  <div key={h.term_id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-[11px] font-semibold text-ink-600">
                      {h.semester}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-ink-800">{h.term_name}</p>
                      <p className="text-[11px] text-ink-400">
                        ចំណាត់ថ្នាក់ទី {h.rank ?? "—"} · {h.subject_count} មុខវិជ្ជា
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-ink-800">{formatNumber(h.average)}</span>
                    <GradeBadge grade={h.grade} />
                  </div>
                ))
            )}
          </SectionCard>
        </div>
      </div>

      <StudentFormModal open={editOpen} onClose={() => setEditOpen(false)} student={student} />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <Icon size={14} className="mt-0.5 shrink-0 text-ink-400" />
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-wide text-ink-400">{label}</p>
        <p className="truncate text-[12.5px] font-medium text-ink-800">{value}</p>
      </div>
    </div>
  );
}

function gradeOf(avg: number | null, scale: { grade: string; min: number }[]) {
  if (avg === null) return null;
  return [...scale].sort((a, b) => b.min - a.min).find((g) => avg >= g.min)?.grade ?? null;
}
