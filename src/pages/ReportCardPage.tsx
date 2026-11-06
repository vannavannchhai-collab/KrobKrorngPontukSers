import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import type { GradeInfo, StudentResult, Term } from "../lib/types";
import { PageLoader } from "../components/ui";
import { cn, formatDate, formatNumber, formatScore, genderLabel } from "../lib/utils";

interface ReportResponse {
  student: {
    id: number;
    code: string;
    last_name_kh: string;
    first_name_kh: string;
    first_name_en: string | null;
    last_name_en: string | null;
    gender: string;
    dob: string | null;
    class_name: string | null;
    grade_level: number | null;
    guardian_name: string | null;
    guardian_phone: string | null;
    address: string | null;
    homeroom_name: string | null;
    status: string;
  };
  result: StudentResult | null;
  term: Term | null;
  year: { id: number; name: string } | null;
  attendance: { present: number; absent: number; late: number; permission: number } | null;
  classSize: number;
  settings: {
    school_name: string;
    school_name_en: string;
    school_address: string;
    school_phone: string;
    school_email: string;
    director_name: string;
    motto: string;
    pass_mark: number;
  };
  gradeScale: GradeInfo[];
  teacherMap: Record<string, string | null>;
}

function gradeOf(avg: number | null, scale: GradeInfo[]): string {
  if (avg === null) return "—";
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  return sorted.find((g) => avg >= g.min)?.grade ?? "—";
}

export default function ReportCardPage() {
  const { id } = useParams();
  const { data: meta } = useMeta();
  const [termId, setTermId] = useState<number | null>(null);
  const activeTerm = termId ?? meta?.settings.term_id ?? null;

  useEffect(() => {
    const fromUrl = Number(new URLSearchParams(window.location.search).get("term_id"));
    if (fromUrl) setTermId(fromUrl);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["report-card", id, activeTerm],
    queryFn: () => api<ReportResponse>(`/results/student/${id}`, { query: { term_id: activeTerm } }),
    enabled: !!id && !!activeTerm,
  });

  if (isLoading || !data) return <PageLoader label="កំពុងបង្កើតសៀវភៅពិន្ទុ…" />;

  const { student, result, term, year, settings, attendance, classSize, gradeScale } = data;
  const scoreTypes = meta?.scoreTypes ?? [];
  const nameKh = `${student.last_name_kh} ${student.first_name_kh}`;
  const nameEn = [student.first_name_en, student.last_name_en].filter(Boolean).join(" ");
  const gpa = result?.average ?? null;
  const remark =
    gpa === null
      ? "មិនទាន់មានទិន្នន័យគ្រប់គ្រាន់សម្រាប់វាយតម្លៃ"
      : gpa >= 90
        ? "លទ្ធផលសិក្សាល្អប្រសើរណាស់ សូមបន្តខិតខំបន្ថែមទៀត"
        : gpa >= 80
          ? "លទ្ធផលសិក្សាល្អ សូមរក្សាគុណភាពបន្ត"
          : gpa >= 70
            ? "លទ្ធផលមធ្យមល្អ គួរខិតខំបន្ថែមលើមុខវិជ្ជាខ្សោយ"
            : gpa >= 50
              ? "លទ្ធផលមធ្យម សូមយកចិត្តទុកដាក់លើការរៀនសូត្របន្ថែម"
              : "លទ្ធផលមិនទាន់គាប់ចិត្ត ត្រូវការជំនួយបន្ថែមពីគ្រូ និងអ្នកអភិបាល";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <Link to={`/students/${student.id}`} className="btn-secondary btn-sm">
          <ArrowLeft size={14} /> ត្រឡប់
        </Link>
        <select className="input w-auto py-1.5 text-xs" value={activeTerm ?? ""} onChange={(e) => setTermId(Number(e.target.value))}>
          {meta?.terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {meta.years.find((y) => y.id === t.academic_year_id)?.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <Link to={`/transcript/${student.id}`} className="btn-secondary btn-sm">
            មើលសញ្ញាបត្រ
          </Link>
          <button className="btn-primary btn-sm" onClick={() => window.print()}>
            <Printer size={14} /> បោះពុម្ពសៀវភៅពិន្ទុ
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[840px] rounded-2xl border border-ink-200 bg-white p-6 shadow-card print-area sm:p-9">
        {/* National header */}
        <div className="text-center">
          <p className="text-[13px] font-bold leading-tight text-ink-950">ព្រះរាជាណាចក្រកម្ពុជា</p>
          <p className="text-[12px] font-semibold leading-tight text-ink-800">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
          <div className="mx-auto mt-1 h-px w-28 bg-ink-400" />
          <p className="mt-3 text-[15px] font-bold text-ink-950">{settings.school_name}</p>
          <p className="text-[11px] text-ink-500">{settings.school_name_en}</p>
          <p className="mt-0.5 text-[10.5px] text-ink-500">{settings.school_address}</p>
          <p className="text-[10.5px] text-ink-500">
            ទូរស័ព្ទ: {settings.school_phone} · អ៊ីមែល: {settings.school_email}
          </p>
        </div>

        <div className="mt-5 text-center">
          <h1 className="text-[17px] font-bold uppercase tracking-wide text-ink-950">សៀវភៅពិន្ទុសិស្ស</h1>
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-ink-400">Student Report Card</p>
          <p className="mt-1 text-[12px] font-medium text-ink-700">
            {term?.name} · ឆ្នាំសិក្សា {year?.name ?? "—"}
          </p>
        </div>

        {/* Student info */}
        <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5 rounded-xl bg-ink-50/70 px-4 py-3 text-[12px]">
          <InfoLine label="ឈ្មោះសិស្ស" value={nameKh} strong />
          <InfoLine label="ឈ្មោះឡាតាំង" value={nameEn || "—"} />
          <InfoLine label="កូដសិស្ស" value={student.code} />
          <InfoLine
            label="ថ្នាក់"
            value={student.class_name ? `ថ្នាក់ទី${student.grade_level}${student.class_name}` : "—"}
          />
          <InfoLine label="ភេទ" value={genderLabel(student.gender)} />
          <InfoLine label="ថ្ងៃកំណើត" value={formatDate(student.dob)} />
          <InfoLine label="អ្នកអភិបាល" value={student.guardian_name ?? "—"} />
          <InfoLine label="ទូរស័ព្ទអ្នកអភិបាល" value={student.guardian_phone ?? "—"} />
        </div>

        {/* Scores table */}
        <table className="mt-4 w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-ink-100/80">
              <th className="border border-ink-300 px-2 py-2 text-left">មុខវិជ្ជា</th>
              <th className="border border-ink-300 px-1 py-2 text-center w-10">ក្រេឌីត</th>
              {scoreTypes.map((t) => (
                <th key={t.id} className="border border-ink-300 px-1 py-2 text-center">
                  <div className="text-[10.5px] leading-tight">{t.name_kh}</div>
                  <div className="text-[9px] font-normal text-ink-500">({t.weight}%)</div>
                </th>
              ))}
              <th className="border border-ink-300 px-1 py-2 text-center">មធ្យមភាគ</th>
              <th className="border border-ink-300 px-1 py-2 text-center w-12">និទ្ទេស</th>
            </tr>
          </thead>
          <tbody>
            {result?.subjects.map((sub) => (
              <tr key={sub.subject_id} className="even:bg-ink-50/40">
                <td className="border border-ink-300 px-2 py-1.5 font-medium text-ink-800">{sub.subject_name}</td>
                <td className="border border-ink-300 px-1 py-1.5 text-center text-ink-500">{sub.credits}</td>
                {scoreTypes.map((t) => (
                  <td key={t.id} className="border border-ink-300 px-1 py-1.5 text-center text-ink-700">
                    {sub.scores[t.code] === null || sub.scores[t.code] === undefined ? "—" : formatScore(sub.scores[t.code])}
                  </td>
                ))}
                <td className="border border-ink-300 px-1 py-1.5 text-center font-semibold text-ink-900">
                  {formatNumber(sub.average)}
                </td>
                <td className="border border-ink-300 px-1 py-1.5 text-center font-bold">
                  {gradeOf(sub.average, gradeScale)}
                </td>
              </tr>
            ))}
            {(!result || result.subjects.length === 0) && (
              <tr>
                <td colSpan={scoreTypes.length + 4} className="border border-ink-300 px-3 py-6 text-center text-ink-400">
                  មិនទាន់មានទិន្នន័យពិន្ទុសម្រាប់ឆមាសនេះ
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-ink-100/70 font-semibold">
              <td className="border border-ink-300 px-2 py-2" colSpan={scoreTypes.length + 3}>
                មធ្យមភាគសរុប
              </td>
              <td className="border border-ink-300 px-1 py-2 text-center text-[13px]">{formatNumber(gpa)}</td>
              <td className="border border-ink-300 px-1 py-2 text-center text-[13px]">{result?.grade ?? "—"}</td>
            </tr>
          </tfoot>
        </table>

        {/* Summary */}
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <SummaryBox label="មធ្យមភាគ" value={formatNumber(gpa)} />
          <SummaryBox label="ចំណាត់ថ្នាក់" value={result?.rank ? `ទី ${result.rank} / ${classSize}` : "—"} />
          <SummaryBox label="និទ្ទេស" value={result?.grade ?? "—"} />
          <SummaryBox
            label="លទ្ធផល"
            value={result?.passed === null || result?.passed === undefined ? "—" : result.passed ? "ជាប់" : "ធ្លាក់"}
            tone={result?.passed === false ? "danger" : "success"}
          />
        </div>

        {/* Attendance + remarks */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-200 p-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">វត្តមានប្រចាំឆមាស</p>
            <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
              <AttStat label="វត្តមាន" value={attendance?.present ?? 0} tone="text-emerald-600" />
              <AttStat label="អវត្តមាន" value={attendance?.absent ?? 0} tone="text-rose-600" />
              <AttStat label="មកយឺត" value={attendance?.late ?? 0} tone="text-amber-600" />
              <AttStat label="សុំច្បាប់" value={attendance?.permission ?? 0} tone="text-sky-600" />
            </div>
          </div>
          <div className="rounded-lg border border-ink-200 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">មតិយោបល់គ្រូបន្ទុកថ្នាក់</p>
            <p className="text-[11.5px] leading-relaxed text-ink-700">{remark}</p>
          </div>
        </div>

        {/* Grade scale legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-ink-50 px-3 py-2 text-[10px] text-ink-500">
          <span className="font-semibold text-ink-600">និទ្ទេស:</span>
          {gradeScale.map((g) => (
            <span key={g.grade}>
              {g.grade} ≥ {g.min} ({g.remark})
            </span>
          ))}
          <span className="ml-auto">កំណត់ជាប់ ≥ {settings.pass_mark} ពិន្ទុ</span>
        </div>

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-[11.5px]">
          <div>
            <p className="font-medium text-ink-700">ហត្ថលេខាអ្នកអភិបាល</p>
            <div className="h-16" />
            <p className="border-t border-ink-300 pt-1 text-ink-600">{student.guardian_name ?? "……………………"}</p>
          </div>
          <div>
            <p className="font-medium text-ink-700">គ្រូបន្ទុកថ្នាក់</p>
            <div className="h-16" />
            <p className="border-t border-ink-300 pt-1 text-ink-600">{student.homeroom_name ?? "……………………"}</p>
          </div>
          <div>
            <p className="font-medium text-ink-700">នាយកសាលា</p>
            <div className="h-16" />
            <p className="border-t border-ink-300 pt-1 text-ink-600">{settings.director_name}</p>
          </div>
        </div>

        <p className="mt-6 border-t border-dashed border-ink-200 pt-2 text-center text-[9.5px] text-ink-400">
          បោះពុម្ពដោយប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស · {formatDate(new Date().toISOString())} ·{" "}
          {settings.school_name}
        </p>
      </div>
    </div>
  );
}

function InfoLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-[120px] shrink-0 text-ink-500">{label}</span>
      <span className={cn("flex-1 truncate", strong ? "font-semibold text-ink-950" : "text-ink-800")}>{value}</span>
    </div>
  );
}

function SummaryBox({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-center",
        tone === "danger"
          ? "border-rose-200 bg-rose-50"
          : tone === "success"
            ? "border-emerald-200 bg-emerald-50"
            : "border-ink-200 bg-white",
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-ink-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[15px] font-bold",
          tone === "danger" ? "text-rose-700" : tone === "success" ? "text-emerald-700" : "text-ink-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function AttStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className={cn("text-[13px] font-bold", tone)}>{value}</p>
      <p className="text-[10px] text-ink-500">{label}</p>
    </div>
  );
}
