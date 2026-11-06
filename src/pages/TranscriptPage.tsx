import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import type { GradeInfo } from "../lib/types";
import { PageLoader } from "../components/ui";
import { cn, formatDate, formatNumber, genderLabel } from "../lib/utils";

interface TranscriptResponse {
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
    guardian_name: string | null;
  };
  rows: {
    term_id: number;
    term_name: string;
    year_name: string;
    semester: number;
    average: number | null;
    grade: string | null;
    rank: number | null;
    passed: boolean | null;
  }[];
  settings: Record<string, string>;
  gradeScale: GradeInfo[];
}

export default function TranscriptPage() {
  const { id } = useParams();
  const { data: meta } = useMeta();
  const { data, isLoading } = useQuery({
    queryKey: ["transcript", id],
    queryFn: () => api<TranscriptResponse>(`/results/transcript/${id}`),
    enabled: !!id,
  });

  if (isLoading || !data) return <PageLoader label="កំពុងបង្កើតសញ្ញាបត្រ…" />;

  const { student, rows } = data;
  const withAvg = rows.filter((r) => r.average !== null);
  const cumulative = withAvg.length
    ? withAvg.reduce((a, b) => a + (b.average ?? 0), 0) / withAvg.length
    : null;
  const bestTerm = [...withAvg].sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <Link to={`/students/${student.id}`} className="btn-secondary btn-sm">
          <ArrowLeft size={14} /> ត្រឡប់
        </Link>
        <button className="btn-primary btn-sm ml-auto" onClick={() => window.print()}>
          <Printer size={14} /> បោះពុម្ពសញ្ញាបត្រ
        </button>
      </div>

      <div className="mx-auto w-full max-w-[820px] rounded-2xl border border-ink-200 bg-white p-6 shadow-card print-area sm:p-9">
        <div className="text-center">
          <p className="text-[13px] font-bold text-ink-950">ព្រះរាជាណាចក្រកម្ពុជា</p>
          <p className="text-[12px] font-semibold text-ink-800">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
          <div className="mx-auto mt-1 h-px w-28 bg-ink-400" />
          <p className="mt-3 text-[15px] font-bold text-ink-950">{data.settings.school_name}</p>
          <p className="text-[10.5px] text-ink-500">{data.settings.school_address}</p>
        </div>

        <h1 className="mt-5 text-center text-[17px] font-bold uppercase tracking-wide text-ink-950">
          សញ្ញាបត្រលទ្ធផលសិក្សា
        </h1>
        <p className="text-center text-[10.5px] uppercase tracking-[0.18em] text-ink-400">Academic Transcript</p>

        <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5 rounded-xl bg-ink-50/70 px-4 py-3 text-[12px]">
          <Row label="ឈ្មោះសិស្ស" value={`${student.last_name_kh} ${student.first_name_kh}`} strong />
          <Row
            label="ឈ្មោះឡាតាំង"
            value={[student.first_name_en, student.last_name_en].filter(Boolean).join(" ") || "—"}
          />
          <Row label="កូដសិស្ស" value={student.code} />
          <Row label="ភេទ" value={genderLabel(student.gender)} />
          <Row label="ថ្ងៃកំណើត" value={formatDate(student.dob)} />
          <Row label="ថ្នាក់បច្ចុប្បន្ន" value={student.class_name ?? "—"} />
        </div>

        <table className="mt-4 w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-ink-100/80">
              <th className="border border-ink-300 px-3 py-2 text-left">ឆ្នាំសិក្សា</th>
              <th className="border border-ink-300 px-3 py-2 text-left">ឆមាស</th>
              <th className="border border-ink-300 px-3 py-2 text-center">មធ្យមភាគ</th>
              <th className="border border-ink-300 px-3 py-2 text-center">និទ្ទេស</th>
              <th className="border border-ink-300 px-3 py-2 text-center">ចំណាត់ថ្នាក់</th>
              <th className="border border-ink-300 px-3 py-2 text-center">លទ្ធផល</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-ink-300 px-3 py-6 text-center text-ink-400">
                  មិនទាន់មានទិន្នន័យលទ្ធផលសិក្សា
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.term_id} className="even:bg-ink-50/40">
                  <td className="border border-ink-300 px-3 py-1.5">{r.year_name}</td>
                  <td className="border border-ink-300 px-3 py-1.5">{r.term_name}</td>
                  <td className="border border-ink-300 px-3 py-1.5 text-center font-semibold">{formatNumber(r.average)}</td>
                  <td className="border border-ink-300 px-3 py-1.5 text-center font-bold">{r.grade ?? "—"}</td>
                  <td className="border border-ink-300 px-3 py-1.5 text-center">{r.rank ?? "—"}</td>
                  <td
                    className={cn(
                      "border border-ink-300 px-3 py-1.5 text-center",
                      r.passed === false ? "text-rose-600" : r.passed ? "text-emerald-600" : "",
                    )}
                  >
                    {r.passed === null ? "—" : r.passed ? "ជាប់" : "ធ្លាក់"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-ink-100/70">
              <td className="border border-ink-300 px-3 py-2 font-semibold" colSpan={2}>
                មធ្យមភាគបង្គំនូល (Cumulative)
              </td>
              <td className="border border-ink-300 px-3 py-2 text-center text-[13px] font-bold">{formatNumber(cumulative)}</td>
              <td className="border border-ink-300 px-3 py-2 text-center font-bold" colSpan={3}>
                {cumulative !== null
                  ? ([...data.gradeScale].sort((a, b) => b.min - a.min).find((g) => cumulative >= g.min)?.grade ?? "—")
                  : "—"}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-ink-200 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-ink-500">ឆមាសសិក្សាសរុប</p>
            <p className="text-[15px] font-bold text-ink-900">{withAvg.length}</p>
          </div>
          <div className="rounded-lg border border-ink-200 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-ink-500">លទ្ធផលល្អបំផុត</p>
            <p className="text-[15px] font-bold text-emerald-700">
              {bestTerm ? `${formatNumber(bestTerm.average)} (${bestTerm.term_name})` : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-ink-200 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-ink-500">អត្រាជាប់</p>
            <p className="text-[15px] font-bold text-brand-700">
              {withAvg.length
                ? `${Math.round((withAvg.filter((r) => r.passed).length / withAvg.length) * 100)}%`
                : "—"}
            </p>
          </div>
        </div>

        <div className="mt-10 flex justify-between text-center text-[11.5px]">
          <div>
            <p className="text-ink-500">ធ្វើនៅ {formatDate(new Date().toISOString())}</p>
          </div>
          <div>
            <p className="font-medium text-ink-700">នាយកសាលា</p>
            <div className="h-16" />
            <p className="border-t border-ink-300 px-8 pt-1 text-ink-600">{data.settings.director_name}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-[120px] shrink-0 text-ink-500">{label}</span>
      <span className={cn("flex-1 truncate", strong ? "font-semibold text-ink-950" : "text-ink-800")}>{value}</span>
    </div>
  );
}
