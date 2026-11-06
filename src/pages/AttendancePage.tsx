import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarCheck2, CheckCheck, Download, Save, Users } from "lucide-react";
import { api, download } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import type { AttendanceResponse } from "../lib/types";
import { EmptyState, PageLoader, Spinner, Tabs } from "../components/ui";
import { useToast } from "../components/Toast";
import { cn, attendanceLabel, formatDate, todayISO } from "../lib/utils";

type Status = "present" | "absent" | "late" | "permission";

const STATUS_META: Record<Status, { label: string; short: string; active: string; dot: string }> = {
  present: { label: "វត្តមាន", short: "វ", active: "bg-emerald-600 text-white border-emerald-600", dot: "bg-emerald-500" },
  absent: { label: "អវត្តមាន", short: "អ", active: "bg-rose-600 text-white border-rose-600", dot: "bg-rose-500" },
  late: { label: "មកយឺត", short: "យ", active: "bg-amber-500 text-white border-amber-500", dot: "bg-amber-400" },
  permission: { label: "សុំច្បាប់", short: "ច", active: "bg-sky-600 text-white border-sky-600", dot: "bg-sky-500" },
};

interface MonthlyResponse {
  days: string[];
  month: string;
  students: {
    id: number;
    code: string;
    name_kh: string;
    days: Record<string, string>;
    present: number;
    absent: number;
    late: number;
    permission: number;
  }[];
}

export default function AttendancePage() {
  const { data: meta } = useMeta();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"daily" | "monthly">("daily");
  const [classId, setClassId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [draft, setDraft] = useState<Record<number, Status>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!meta) return;
    setClassId((c) => c ?? meta.classes[0]?.id ?? null);
  }, [meta]);

  const dailyQuery = useQuery({
    queryKey: ["attendance", classId, date],
    queryFn: () => api<AttendanceResponse>("/attendance", { query: { class_id: classId, date } }),
    enabled: !!classId && tab === "daily",
  });

  const monthlyQuery = useQuery({
    queryKey: ["attendance-monthly", classId, month],
    queryFn: () => api<MonthlyResponse>("/attendance/monthly", { query: { class_id: classId, month } }),
    enabled: !!classId && tab === "monthly",
  });

  useEffect(() => {
    if (!dailyQuery.data) return;
    const next: Record<number, Status> = {};
    for (const s of dailyQuery.data.students) {
      next[s.id] = (dailyQuery.data.records[s.id]?.status as Status) ?? "present";
    }
    setDraft(next);
    setDirty(false);
  }, [dailyQuery.data]);

  const counts = useMemo(() => {
    const out = { present: 0, absent: 0, late: 0, permission: 0 };
    for (const v of Object.values(draft)) out[v]++;
    return out;
  }, [draft]);

  const markAll = (status: Status) => {
    if (!dailyQuery.data) return;
    const next: Record<number, Status> = {};
    for (const s of dailyQuery.data.students) next[s.id] = status;
    setDraft(next);
    setDirty(true);
  };

  const save = async () => {
    if (!classId || !dailyQuery.data) return;
    setSaving(true);
    try {
      const entries = dailyQuery.data.students.map((s) => ({
        student_id: s.id,
        status: draft[s.id] ?? "present",
        note: null,
      }));
      const res = await api<{ saved: number }>("/attendance/bulk", {
        method: "PUT",
        body: { class_id: classId, date, entries },
      });
      toast.success("បានរក្សាទុកវត្តមាន", `${res.saved} នាក់ · ${formatDate(date)}`);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance-monthly"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e: any) {
      toast.error("រក្សាទុកមិនបានសម្រេច", e.message);
    } finally {
      setSaving(false);
    }
  };

  if (meta && meta.classes.length === 0) {
    return (
      <div className="card animate-fade-in">
        <EmptyState
          icon={CalendarCheck2}
          title="មិនទាន់មានថ្នាក់រៀន"
          description="សូមបង្កើតថ្នាក់រៀន និងបន្ថែមសិស្សជាមុន ទើបអាចកត់ត្រាវត្តមានបាន។"
          action={
            <Link to="/classes" className="btn-primary btn-sm">
              ទៅគ្រប់គ្រងថ្នាក់រៀន
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "daily", label: "កត់ត្រាប្រចាំថ្ងៃ" },
            { value: "monthly", label: "សេចក្ដីសង្ខេបប្រចាំខែ" },
          ]}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="input w-auto py-1.5 text-xs" value={classId ?? ""} onChange={(e) => setClassId(Number(e.target.value))}>
            {meta?.classes.map((c) => (
              <option key={c.id} value={c.id}>
                ថ្នាក់ទី{c.grade_level}
                {c.name}
              </option>
            ))}
          </select>
          {tab === "daily" ? (
            <input type="date" className="input w-auto py-1.5 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
          ) : (
            <input type="month" className="input w-auto py-1.5 text-xs" value={month} onChange={(e) => setMonth(e.target.value)} />
          )}
        </div>
      </div>

      {tab === "daily" ? (
        dailyQuery.isLoading ? (
          <PageLoader label="កំពុងផ្ទុកវត្តមាន…" />
        ) : !dailyQuery.data ? (
          <EmptyState title="មិនអាចផ្ទុកបាន" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(STATUS_META) as Status[]).map((st) => (
                <div key={st} className="card flex items-center gap-3 p-3.5">
                  <span className={cn("h-9 w-1.5 rounded-full", STATUS_META[st].dot)} />
                  <div>
                    <p className="text-[11px] text-ink-500">{STATUS_META[st].label}</p>
                    <p className="text-lg font-bold leading-tight text-ink-950">{counts[st]}</p>
                  </div>
                </div>
              ))}
            </div>

            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-4 py-3">
                <CalendarCheck2 size={16} className="text-brand-500" />
                <h3 className="text-sm font-semibold text-ink-900">
                  វត្តមានថ្ងៃ {formatDate(date)}
                </h3>
                <span className="badge bg-ink-100 text-ink-600">{dailyQuery.data.students.length} នាក់</span>
                {dailyQuery.data.marked > 0 ? (
                  <span className="badge bg-emerald-50 text-emerald-700">បានកត់ត្រារួច {dailyQuery.data.marked} នាក់</span>
                ) : (
                  <span className="badge bg-amber-50 text-amber-700">មិនទាន់កត់ត្រា</span>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {dailyQuery.data.canEdit ? (
                    <>
                      <button className="btn-secondary btn-sm" onClick={() => markAll("present")}>
                        <CheckCheck size={14} /> វត្តមានទាំងអស់
                      </button>
                      <button className="btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
                        {saving ? <Spinner /> : <Save size={14} />} រក្សាទុក
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-amber-700">អ្នកគ្មានសិទ្ធិកែប្រែវត្តមានថ្នាក់នេះ</span>
                  )}
                </div>
              </div>

              {dailyQuery.data.students.length === 0 ? (
                <EmptyState icon={Users} title="ថ្នាក់នេះគ្មានសិស្ស" />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {dailyQuery.data.students.map((s, i) => {
                    const current = draft[s.id] ?? "present";
                    return (
                      <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-ink-50/50">
                        <span className="w-6 text-[11px] text-ink-400">{i + 1}</span>
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold",
                            s.gender === "M" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700",
                          )}
                        >
                          {s.name_kh.charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink-900">{s.name_kh}</p>
                          <p className="text-[10.5px] text-ink-400">{s.code}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {(Object.keys(STATUS_META) as Status[]).map((st) => (
                            <button
                              key={st}
                              disabled={!dailyQuery.data!.canEdit}
                              onClick={() => {
                                setDraft((d) => ({ ...d, [s.id]: st }));
                                setDirty(true);
                              }}
                              className={cn(
                                "min-w-[62px] rounded-lg border px-2 py-1.5 text-[11.5px] font-medium transition",
                                current === st
                                  ? STATUS_META[st].active
                                  : "border-ink-200 bg-white text-ink-500 hover:border-ink-300 hover:bg-ink-50",
                                "disabled:cursor-not-allowed disabled:opacity-60",
                              )}
                            >
                              {STATUS_META[st].label}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {dirty ? (
                <div className="border-t border-ink-100 bg-amber-50/60 px-4 py-2 text-[11.5px] text-amber-800">
                  អ្នកមានការផ្លាស់ប្ដូរដែលមិនបានរក្សាទុក — សូមចុច «រក្សាទុក»
                </div>
              ) : null}
            </section>
          </>
        )
      ) : monthlyQuery.isLoading ? (
        <PageLoader label="កំពុងផ្ទុកសេចក្ដីសង្ខេប…" />
      ) : !monthlyQuery.data ? (
        <EmptyState title="មិនអាចផ្ទុកបាន" />
      ) : (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-ink-900">
              វត្តមានប្រចាំខែ {monthlyQuery.data.month}
            </h3>
            <span className="badge bg-ink-100 text-ink-600">{monthlyQuery.data.students.length} នាក់</span>
            <button
              className="btn-secondary btn-sm ml-auto"
              onClick={() => download(`/attendance/export/csv?class_id=${classId}&month=${month}`, `attendance-${month}.csv`)}
            >
              <Download size={14} /> នាំចេញ CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[11px]">
              <thead>
                <tr className="bg-ink-50/80">
                  <th className="th sticky left-0 z-10 bg-ink-50/95">ឈ្មោះសិស្ស</th>
                  {monthlyQuery.data.days.map((d) => (
                    <th key={d} className="px-0.5 py-2 text-center text-[9.5px] font-medium text-ink-500">
                      {Number(d.slice(8))}
                    </th>
                  ))}
                  <th className="th text-center">វ</th>
                  <th className="th text-center">អ</th>
                  <th className="th text-center">យ</th>
                  <th className="th text-center">ច</th>
                </tr>
              </thead>
              <tbody>
                {monthlyQuery.data.students.map((s) => (
                  <tr key={s.id} className="border-t border-ink-100 hover:bg-brand-50/30">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 group-hover:bg-brand-50/60">
                      <p className="text-[12px] font-medium text-ink-800">{s.name_kh}</p>
                      <p className="text-[10px] text-ink-400">{s.code}</p>
                    </td>
                    {monthlyQuery.data.days.map((d) => {
                      const st = s.days[d] as Status | undefined;
                      return (
                        <td key={d} className="px-0.5 py-2 text-center">
                          <span
                            title={st ? attendanceLabel(st) : "មិនបានកត់ត្រា"}
                            className={cn(
                              "inline-block h-4 w-4 rounded",
                              st ? STATUS_META[st].dot : "bg-ink-100",
                            )}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center font-semibold text-emerald-600">{s.present}</td>
                    <td className="px-2 py-2 text-center font-semibold text-rose-600">{s.absent}</td>
                    <td className="px-2 py-2 text-center font-semibold text-amber-600">{s.late}</td>
                    <td className="px-2 py-2 text-center font-semibold text-sky-600">{s.permission}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-ink-100 bg-ink-50/50 px-4 py-2 text-[11px] text-ink-500">
            {(Object.keys(STATUS_META) as Status[]).map((st) => (
              <span key={st} className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded", STATUS_META[st].dot)} /> {STATUS_META[st].label}
              </span>
            ))}
            <span className="ml-auto">សរុប {monthlyQuery.data.days.length} ថ្ងៃ (ថ្ងៃធ្វើការ)</span>
          </div>
        </section>
      )}
    </div>
  );
}
