import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Search } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState, Pagination, TableSkeleton } from "../components/ui";
import { cn, formatDate } from "../lib/utils";

interface LogRow {
  id: number;
  user_name: string;
  action: string;
  entity: string;
  entity_id: number | null;
  detail: string;
  ip: string | null;
  created_at: string;
}

const ACTION_STYLES: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700",
  update: "bg-brand-50 text-brand-700",
  delete: "bg-rose-50 text-rose-700",
  login: "bg-sky-50 text-sky-700",
  import: "bg-violet-50 text-violet-700",
};

const ACTION_LABELS: Record<string, string> = {
  create: "បង្កើត",
  update: "កែប្រែ",
  delete: "លុប",
  login: "ចូលប្រើ",
  import: "នាំចូល",
};

const ENTITY_LABELS: Record<string, string> = {
  student: "សិស្ស",
  score: "ពិន្ទុ",
  class: "ថ្នាក់",
  class_subject: "មុខវិជ្ជាថ្នាក់",
  subject: "មុខវិជ្ជា",
  user: "គណនី",
  settings: "ការកំណត់",
  attendance: "វត្តមាន",
  academic_year: "ឆ្នាំសិក្សា",
  term: "ឆមាស",
  score_type: "ប្រភេទពិន្ទុ",
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit", page, limit, search, action],
    queryFn: () =>
      api<{ data: LogRow[]; total: number; page: number; limit: number }>("/admin/audit", {
        query: { page, limit, search, action },
      }),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-base font-semibold text-ink-950">កំណត់ត្រាសកម្មភាពប្រព័ន្ធ</h2>
        <p className="text-xs text-ink-500">
          តាមដានរាល់ការផ្លាស់ប្ដូរទិន្នន័យ — អ្នកណា ធ្វើអ្វី និងនៅពេលណា
        </p>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3.5">
          <form
            className="relative min-w-[240px] flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(searchInput);
            }}
          >
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="ស្វែងរកឈ្មោះ ឬសកម្មភាព…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </form>
          <select
            className="input w-auto"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">គ្រប់សកម្មភាព</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-ink-50/70">
              <tr>
                <th className="th w-16">#</th>
                <th className="th">សកម្មភាព</th>
                <th className="th">ប្រភេទ</th>
                <th className="th">ព័ត៌មានលម្អិត</th>
                <th className="th">អ្នកប្រើ</th>
                <th className="th">ពេលវេលា</th>
                <th className="th">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7}>
                    <TableSkeleton rows={8} cols={5} />
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={ScrollText} title="គ្មានកំណត់ត្រា" description="សកម្មភាពរបស់អ្នកនឹងបង្ហាញនៅទីនេះ" />
                  </td>
                </tr>
              ) : (
                data?.data.map((log) => (
                  <tr key={log.id} className="table-row">
                    <td className="td text-[11px] text-ink-400">{log.id}</td>
                    <td className="td">
                      <span className={cn("badge", ACTION_STYLES[log.action] ?? "bg-ink-100 text-ink-600")}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="td text-[12px] text-ink-600">{ENTITY_LABELS[log.entity] ?? log.entity}</td>
                    <td className="td max-w-[340px] truncate text-[12px] text-ink-700">{log.detail}</td>
                    <td className="td text-[12px] text-ink-600">{log.user_name}</td>
                    <td className="td text-[11.5px] text-ink-500">{formatDate(log.created_at)}</td>
                    <td className="td text-[11px] text-ink-400">{log.ip ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data ? (
          <Pagination
            page={page}
            limit={limit}
            total={data.total}
            onPage={setPage}
            onLimit={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        ) : null}
      </section>
    </div>
  );
}
