import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRightLeft,
  Download,
  FileUp,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { api, download } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import { useAuth } from "../lib/auth";
import type { Student } from "../lib/types";
import {
  Avatar,
  ConfirmDialog,
  EmptyState,
  Field,
  GradeBadge,
  Modal,
  Pagination,
  Spinner,
  StatusBadge,
  TableSkeleton,
} from "../components/ui";
import { StudentFormModal } from "../components/StudentFormModal";
import { ImportStudentsModal } from "../components/ImportStudentsModal";
import { useToast } from "../components/Toast";
import { cn, formatDate, formatNumber, genderLabel } from "../lib/utils";

interface StudentsResponse {
  data: Student[];
  total: number;
  page: number;
  limit: number;
  summary: { total: number; male: number; female: number; active: number };
  termId: number;
}

export default function StudentsPage() {
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const qc = useQueryClient();
  const toast = useToast();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [gender, setGender] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("class");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selected, setSelected] = useState<number[]>([]);
  const [searchParams] = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferClass, setTransferClass] = useState("");

  useEffect(() => {
    const fromUrl = searchParams.get("class");
    if (fromUrl) setClassId(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setSelected([]);
  }, [page, classId, gender, status, search, sort]);

  const params = {
    search,
    class_id: classId,
    gender,
    status,
    sort,
    page,
    limit,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["students", params],
    queryFn: () => api<StudentsResponse>("/students", { query: params }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/students/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("បានលុបសិស្ស");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error("លុបមិនបានសម្រេច", e.message),
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      api("/students/bulk/transfer", {
        method: "POST",
        body: { student_ids: selected, class_id: transferClass ? Number(transferClass) : null },
      }),
    onSuccess: () => {
      toast.success("បានផ្ទេរសិស្ស", `${selected.length} នាក់ ត្រូវបានផ្លាស់ប្ដូរថ្នាក់`);
      setTransferOpen(false);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
    },
    onError: (e: Error) => toast.error("ផ្ទេរមិនបានសម្រេច", e.message),
  });

  const allChecked = useMemo(
    () => !!data?.data.length && data.data.every((s) => selected.includes(s.id)),
    [data, selected],
  );

  const toggleAll = () => {
    if (!data) return;
    setSelected(allChecked ? [] : data.data.map((s) => s.id));
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const isAdmin = user?.role === "admin";
  const classOptions = meta?.classes ?? [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "សិស្សសរុប", value: data?.summary.total ?? 0, icon: Users, tone: "text-brand-600 bg-brand-50" },
          { label: "សិស្សប្រុស", value: data?.summary.male ?? 0, icon: UserRound, tone: "text-sky-600 bg-sky-50" },
          { label: "សិស្សស្រី", value: data?.summary.female ?? 0, icon: UserRound, tone: "text-rose-600 bg-rose-50" },
          { label: "កំពុងសិក្សា", value: data?.summary.active ?? 0, icon: GraduationCap, tone: "text-emerald-600 bg-emerald-50" },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 p-3.5">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", s.tone)}>
              <s.icon size={17} />
            </div>
            <div>
              <p className="text-[11px] text-ink-500">{s.label}</p>
              <p className="text-lg font-bold leading-tight text-ink-950">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3.5">
          <div className="relative min-w-[210px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="ស្វែងរកឈ្មោះ កូដសិស្ស ឬលេខទូរស័ព្ទ…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput ? (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"
                onClick={() => setSearchInput("")}
                aria-label="សម្អាត"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <select
            className="input w-auto min-w-[130px]"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">គ្រប់ថ្នាក់</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                ថ្នាក់ទី{c.grade_level}{c.name}
              </option>
            ))}
          </select>

          <select className="input w-auto" value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }}>
            <option value="">ភេទ</option>
            <option value="M">ប្រុស</option>
            <option value="F">ស្រី</option>
          </select>

          <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="active">កំពុងសិក្សា</option>
            <option value="inactive">ផ្អាក</option>
            <option value="transferred">ផ្ទេរចេញ</option>
            <option value="graduated">បានបញ្ចប់</option>
            <option value="">ទាំងអស់</option>
          </select>

          <select className="input w-auto" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            <option value="class">តាមថ្នាក់</option>
            <option value="name">តាមឈ្មោះ</option>
            <option value="code">តាមកូដ</option>
            <option value="newest">ថ្មីបំផុត</option>
          </select>

          <div className="ml-auto flex items-center gap-2">
            <button className="btn-secondary btn-sm no-print" onClick={() => download("/students/export/csv", "students.csv")}>
              <Download size={14} /> នាំចេញ
            </button>
            {isAdmin ? (
              <>
                <button className="btn-secondary btn-sm no-print" onClick={() => setImportOpen(true)}>
                  <FileUp size={14} /> នាំចូល
                </button>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus size={15} /> បន្ថែមសិស្ស
                </button>
              </>
            ) : null}
          </div>
        </div>

        {selected.length > 0 && isAdmin ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50/70 px-3.5 py-2">
            <span className="text-xs font-medium text-brand-800">បានជ្រើសរើស {selected.length} នាក់</span>
            <button className="btn-secondary btn-sm" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft size={13} /> ផ្ទេរថ្នាក់
            </button>
            <button className="btn-ghost btn-sm ml-auto" onClick={() => setSelected([])}>
              សម្អាតជម្រើស
            </button>
          </div>
        ) : null}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-ink-50/70">
              <tr>
                {isAdmin ? (
                  <th className="th w-10">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600"
                      checked={allChecked}
                      onChange={toggleAll}
                      aria-label="ជ្រើសរើសទាំងអស់"
                    />
                  </th>
                ) : null}
                <th className="th">សិស្ស</th>
                <th className="th">ថ្នាក់</th>
                <th className="th">ភេទ</th>
                <th className="th">ថ្ងៃកំណើត</th>
                <th className="th">អ្នកអភិបាល</th>
                <th className="th text-center">មធ្យមភាគ</th>
                <th className="th text-center">ចំណាត់ថ្នាក់</th>
                <th className="th text-center">និទ្ទេស</th>
                <th className="th">ស្ថានភាព</th>
                <th className="th text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11}>
                    <TableSkeleton rows={8} cols={6} />
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <EmptyState
                      icon={Users}
                      title="រកមិនឃើញសិស្ស"
                      description="សូមព្យាយាមផ្លាស់ប្តូរតម្រង ឬបន្ថែមសិស្សថ្មី"
                      action={
                        isAdmin ? (
                          <button className="btn-primary btn-sm" onClick={() => setFormOpen(true)}>
                            <Plus size={14} /> បន្ថែមសិស្សថ្មី
                          </button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                data?.data.map((s) => (
                  <tr key={s.id} className={cn("table-row", selected.includes(s.id) && "bg-brand-50/40")}>
                    {isAdmin ? (
                      <td className="td">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600"
                          checked={selected.includes(s.id)}
                          onChange={() => toggleOne(s.id)}
                          aria-label={`ជ្រើសរើស ${s.name_kh}`}
                        />
                      </td>
                    ) : null}
                    <td className="td">
                      <Link to={`/students/${s.id}`} className="flex items-center gap-2.5 group">
                        <Avatar name={s.name_kh} size={32} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink-900 group-hover:text-brand-600">
                            {s.name_kh}
                          </p>
                          <p className="text-[11px] text-ink-400">{s.code}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="td">
                      {s.class_name ? (
                        <span className="badge bg-ink-100 text-ink-700">
                          ថ្នាក់ទី{s.grade_level}
                          {s.class_name}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="td">{genderLabel(s.gender)}</td>
                    <td className="td text-ink-500">{formatDate(s.dob)}</td>
                    <td className="td">
                      <p className="text-[12.5px] text-ink-700">{s.guardian_name ?? "—"}</p>
                      <p className="text-[11px] text-ink-400">{s.guardian_phone ?? ""}</p>
                    </td>
                    <td className="td text-center font-semibold text-ink-800">{formatNumber(s.average)}</td>
                    <td className="td text-center">{s.rank ?? "—"}</td>
                    <td className="td text-center">
                      <GradeBadge grade={s.grade} />
                    </td>
                    <td className="td">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-0.5">
                        <Link to={`/students/${s.id}`} className="btn-icon" title="មើលលម្អិត">
                          <UserRound size={15} />
                        </Link>
                        {isAdmin ? (
                          <>
                            <button
                              className="btn-icon"
                              title="កែប្រែ"
                              onClick={() => {
                                setEditing(s);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="btn-icon text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                              title="លុប"
                              onClick={() => setDeleting(s)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
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

        {isFetching && !isLoading ? (
          <div className="flex items-center justify-center gap-2 border-t border-ink-100 py-2 text-[11px] text-ink-400">
            <Spinner className="h-3 w-3" /> កំពុងធ្វើបច្ចុប្បន្នភាព…
          </div>
        ) : null}
      </section>

      <StudentFormModal open={formOpen} onClose={() => setFormOpen(false)} student={editing} />
      <ImportStudentsModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="លុបសិស្ស"
        message={`តើអ្នកប្រាកដជាចង់លុប ${deleting?.name_kh ?? ""} ចេញពីប្រព័ន្ធ? ពិន្ទុ និងវត្តមានទាំងអស់នឹងត្រូវលុបជាមួយផងដែរ។`}
        confirmLabel="លុបជាស្ថាពរ"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />

      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="ផ្ទេរសិស្សទៅថ្នាក់ផ្សេង"
        description={`សិស្ស ${selected.length} នាក់ នឹងត្រូវផ្លាស់ប្ដូរថ្នាក់`}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setTransferOpen(false)}>
              បោះបង់
            </button>
            <button className="btn-primary" onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending}>
              {transferMutation.isPending ? <Spinner /> : <ArrowRightLeft size={15} />} ផ្ទេរឥឡូវ
            </button>
          </>
        }
      >
        <Field label="ថ្នាក់គោលដៅ">
          <select className="input" value={transferClass} onChange={(e) => setTransferClass(e.target.value)}>
            <option value="">— ដកចេញពីថ្នាក់ —</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                ថ្នាក់ទី{c.grade_level}{c.name}
              </option>
            ))}
          </select>
        </Field>
      </Modal>
    </div>
  );
}
