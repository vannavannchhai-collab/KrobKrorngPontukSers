import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UserCog, UserRound } from "lucide-react";
import { api } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import { useAuth } from "../lib/auth";
import type { User } from "../lib/types";
import { Avatar, ConfirmDialog, EmptyState, Field, Modal, Spinner, TableSkeleton } from "../components/ui";
import { useToast } from "../components/Toast";
import { cn, formatDate } from "../lib/utils";

const EMPTY = {
  username: "",
  name: "",
  name_en: "",
  role: "teacher",
  email: "",
  phone: "",
  gender: "M",
  subject_id: "",
  hire_date: "",
  password: "",
  is_active: true,
};

export default function TeachersPage() {
  const { user: me } = useAuth();
  const { data: meta } = useMeta();
  const qc = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ data: User[] }>("/auth/users"),
  });

  const filtered = (data?.data ?? []).filter((u) => {
    const okSearch = !search || u.name.includes(search) || (u.username ?? "").toLowerCase().includes(search.toLowerCase());
    const okRole = !role || u.role === role;
    return okSearch && okRole;
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      username: u.username ?? "",
      name: u.name,
      name_en: u.name_en ?? "",
      role: u.role,
      email: u.email ?? "",
      phone: u.phone ?? "",
      gender: u.gender ?? "M",
      subject_id: u.subject_id ? String(u.subject_id) : "",
      hire_date: u.hire_date ?? "",
      password: "",
      is_active: !!u.is_active,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        subject_id: form.subject_id ? Number(form.subject_id) : null,
        is_active: form.is_active,
      };
      return editing ? api(`/admin/users/${editing.id}`, { method: "PUT", body: payload }) : api("/admin/users", { method: "POST", body: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "បានកែប្រែគណនី" : "បានបង្កើតគណនីថ្មី");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
    },
    onError: (e: Error) => toast.error("រក្សាទុកមិនបានសម្រេច", e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("បានលុបគណនី");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
    },
    onError: (e: Error) => toast.error("លុបមិនបានសម្រេច", e.message),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink-950">គ្រូបង្រៀន និងគណនីប្រព័ន្ធ</h2>
          <p className="text-xs text-ink-500">
            {data?.data.filter((u) => u.role === "teacher").length ?? 0} គ្រូ ·{" "}
            {data?.data.filter((u) => u.role === "admin").length ?? 0} អ្នកគ្រប់គ្រង
          </p>
        </div>
        <button className="btn-primary btn-sm ml-auto" onClick={openCreate}>
          <Plus size={15} /> បង្កើតគណនីថ្មី
        </button>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3.5">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="ស្វែងរកឈ្មោះ ឬឈ្មោះអ្នកប្រើ…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">គ្រប់តួនាទី</option>
            <option value="admin">អ្នកគ្រប់គ្រង</option>
            <option value="teacher">គ្រូបង្រៀន</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-ink-50/70">
              <tr>
                <th className="th">គណនី</th>
                <th className="th">តួនាទី</th>
                <th className="th">មុខវិជ្ជាឯកទេស</th>
                <th className="th">ទំនាក់ទំនង</th>
                <th className="th">ចូលចុងក្រោយ</th>
                <th className="th text-center">ស្ថានភាព</th>
                <th className="th text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7}>
                    <TableSkeleton rows={6} cols={5} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={UserCog} title="រកមិនឃើញគណនី" />
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="table-row">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} size={32} />
                        <div>
                          <p className="text-[13px] font-medium text-ink-900">{u.name}</p>
                          <p className="text-[10.5px] text-ink-400">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <span
                        className={cn(
                          "badge",
                          u.role === "admin" ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-600",
                        )}
                      >
                        {u.role === "admin" ? <ShieldCheck size={11} /> : <UserRound size={11} />}
                        {u.role === "admin" ? "អ្នកគ្រប់គ្រង" : "គ្រូបង្រៀន"}
                      </span>
                    </td>
                    <td className="td text-[12px] text-ink-600">{u.subject_name ?? "—"}</td>
                    <td className="td">
                      <p className="text-[12px] text-ink-600">{u.phone ?? "—"}</p>
                      <p className="text-[10.5px] text-ink-400">{u.email ?? ""}</p>
                    </td>
                    <td className="td text-[11.5px] text-ink-500">
                      {u.last_login_at ? formatDate(u.last_login_at) : "មិនដែលចូល"}
                    </td>
                    <td className="td text-center">
                      <span className={cn("badge", u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600")}>
                        {u.is_active ? "សកម្ម" : "បិទ"}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-0.5">
                        <button className="btn-icon" onClick={() => openEdit(u)} title="កែប្រែ">
                          <Pencil size={15} />
                        </button>
                        <button
                          className="btn-icon text-rose-500 hover:bg-rose-50"
                          onClick={() => setDeleting(u)}
                          disabled={u.id === me?.id}
                          title="លុប"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `កែប្រែគណនី — ${editing.name}` : "បង្កើតគណនីថ្មី"}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              បោះបង់
            </button>
            <button
              className="btn-primary"
              disabled={save.isPending}
              onClick={() => {
                if (!form.name.trim()) return toast.error("សូមបញ្ចូលឈ្មោះ");
                if (!editing && (!form.username.trim() || form.password.length < 6))
                  return toast.error("សូមបញ្ចូលឈ្មោះអ្នកប្រើ និងលេខសម្ងាត់ (≥ ៦ តួអក្សរ)");
                save.mutate();
              }}
            >
              {save.isPending ? <Spinner /> : null} រក្សាទុក
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ឈ្មោះពេញ" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ចាន់ សុភា" />
          </Field>
          <Field label="ឈ្មោះជាឡាតាំង">
            <input className="input" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder="Chan Sophea" />
          </Field>
          <Field label="ឈ្មោះអ្នកប្រើ" required hint="ប្រើសម្រាប់ចូលប្រព័ន្ធ">
            <input
              className="input font-mono"
              value={form.username}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="teacher14"
            />
          </Field>
          <Field label="តួនាទី">
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="teacher">គ្រូបង្រៀន</option>
              <option value="admin">អ្នកគ្រប់គ្រង</option>
            </select>
          </Field>
          <Field label="មុខវិជ្ជាឯកទេស">
            <select className="input" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
              <option value="">— មិនកំណត់ —</option>
              {meta?.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_kh}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ភេទ">
            <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="M">ប្រុស</option>
              <option value="F">ស្រី</option>
            </select>
          </Field>
          <Field label="ទូរស័ព្ទ">
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="អ៊ីមែល (Gmail)" hint="ប្រើសម្រាប់ចូលប្រព័ន្ធ និងទំនាក់ទំនង">
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@gmail.com"
            />
          </Field>
          <Field label="កាលបរិច្ឆេទចូលបម្រើ">
            <input type="date" className="input" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
          </Field>
          <Field
            label={editing ? "លេខសម្ងាត់ថ្មី" : "លេខសម្ងាត់"}
            required={!editing}
            hint={editing ? "ទុកទទេ ដើម្បីរក្សាលេខសម្ងាត់ដើម" : "យ៉ាងតិច ៦ តួអក្សរ"}
          >
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                className="input pl-9 font-mono"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••"
                autoComplete="new-password"
              />
            </div>
          </Field>
          <label className="flex items-center gap-2 text-[12.5px] text-ink-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
            />
            គណនីសកម្ម (អាចចូលប្រើបាន)
          </label>
        </div>
      </Modal>

      {deleting ? (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
          title="លុបគណនី"
          message={`តើអ្នកប្រាកដជាចង់លុបគណនីរបស់ «${deleting.name}»? ការកំណត់គ្រូបង្រៀនដែលពាក់ព័ន្ធនឹងត្រូវដកចេញ។`}
          confirmLabel="លុប"
          loading={remove.isPending}
        />
      ) : null}
    </div>
  );
}
