import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useMeta } from "../lib/useMeta";
import { Field, Modal, Spinner } from "./ui";
import { useToast } from "./Toast";
import type { Student } from "../lib/types";

const EMPTY = {
  code: "",
  last_name_kh: "",
  first_name_kh: "",
  last_name_en: "",
  first_name_en: "",
  gender: "M",
  dob: "",
  class_id: "",
  phone: "",
  guardian_name: "",
  guardian_phone: "",
  address: "",
  enroll_date: new Date().toISOString().slice(0, 10),
  status: "active",
  note: "",
};

type FormState = typeof EMPTY;

export function StudentFormModal({
  open,
  onClose,
  student,
}: {
  open: boolean;
  onClose: () => void;
  student?: Student | null;
}) {
  const { data: meta } = useMeta();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const toast = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setError("");
    if (student) {
      setForm({
        code: student.code ?? "",
        last_name_kh: student.last_name_kh ?? "",
        first_name_kh: student.first_name_kh ?? "",
        last_name_en: student.last_name_en ?? "",
        first_name_en: student.first_name_en ?? "",
        gender: student.gender ?? "M",
        dob: student.dob ?? "",
        class_id: student.class_id ? String(student.class_id) : "",
        phone: student.phone ?? "",
        guardian_name: student.guardian_name ?? "",
        guardian_phone: student.guardian_phone ?? "",
        address: student.address ?? "",
        enroll_date: student.enroll_date ?? EMPTY.enroll_date,
        status: student.status ?? "active",
        note: student.note ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, student]);

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        class_id: form.class_id ? Number(form.class_id) : null,
      };
      return student
        ? api(`/students/${student.id}`, { method: "PUT", body: payload })
        : api("/students", { method: "POST", body: payload });
    },
    onSuccess: () => {
      toast.success(student ? "បានកែប្រែព័ត៌មានសិស្ស" : "បានបន្ថែមសិស្សថ្មី", `${form.last_name_kh} ${form.first_name_kh}`);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const submit = () => {
    setError("");
    if (!form.last_name_kh.trim() || !form.first_name_kh.trim()) {
      setError("សូមបញ្ចូលនាមត្រកូល និងនាមខ្លួន");
      return;
    }
    if (!["M", "F"].includes(form.gender)) {
      setError("សូមជ្រើសរើសភេទ");
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={student ? "កែប្រែព័ត៌មានសិស្ស" : "បន្ថែមសិស្សថ្មី"}
      description={student ? `${student.code} · ${student.name_kh}` : "បំពេញព័ត៌មានសិស្សខាងក្រោម"}
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            បោះបង់
          </button>
          <button className="btn-primary" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : null}
            {student ? "រក្សាទុកការកែប្រែ" : "បន្ថែមសិស្ស"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="កូដសិស្ស" hint="ទុកទទេ ដើម្បីបង្កើតស្វ័យប្រវត្តិ">
            <input className="input" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="STU-0001" />
          </Field>
          <Field label="ថ្នាក់រៀន">
            <select className="input" value={form.class_id} onChange={(e) => set("class_id", e.target.value)}>
              <option value="">— មិនទាន់កំណត់ —</option>
              {meta?.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  ថ្នាក់ទី{c.grade_level}{c.name} ({c.student_count ?? 0} នាក់)
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="នាមត្រកូល (ខ្មែរ)" required>
            <input className="input" value={form.last_name_kh} onChange={(e) => set("last_name_kh", e.target.value)} placeholder="សុខ" />
          </Field>
          <Field label="នាមខ្លួន (ខ្មែរ)" required>
            <input className="input" value={form.first_name_kh} onChange={(e) => set("first_name_kh", e.target.value)} placeholder="ដារា" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Last name (Latin)">
            <input className="input" value={form.last_name_en} onChange={(e) => set("last_name_en", e.target.value)} placeholder="Sok" />
          </Field>
          <Field label="First name (Latin)">
            <input className="input" value={form.first_name_en} onChange={(e) => set("first_name_en", e.target.value)} placeholder="Dara" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="ភេទ" required>
            <select className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="M">ប្រុស</option>
              <option value="F">ស្រី</option>
            </select>
          </Field>
          <Field label="ថ្ងៃខែឆ្នាំកំណើត">
            <input type="date" className="input" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
          </Field>
          <Field label="កាលបរិច្ឆេទចុះឈ្មោះ">
            <input type="date" className="input" value={form.enroll_date} onChange={(e) => set("enroll_date", e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="លេខទូរស័ព្ទសិស្ស">
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="012 345 678" />
          </Field>
          <Field label="ស្ថានភាព">
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">កំពុងសិក្សា</option>
              <option value="inactive">ផ្អាក</option>
              <option value="transferred">ផ្ទេរចេញ</option>
              <option value="graduated">បានបញ្ចប់</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ឈ្មោះអ្នកអភិបាល">
            <input className="input" value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} placeholder="សុខ វិចិត្រ" />
          </Field>
          <Field label="ទូរស័ព្ទអ្នកអភិបាល">
            <input className="input" value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} placeholder="098 765 432" />
          </Field>
        </div>

        <Field label="អាសយដ្ឋាន">
          <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="ភូមិ… ឃុំ… ក្រុង… ខេត្ត…" />
        </Field>

        <Field label="កំណត់សម្គាល់">
          <textarea
            className="input min-h-[70px] resize-y"
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="ព័ត៌មានបន្ថែម (សុខភាព ពិការភាព លក្ខណៈពិសេស…)"
          />
        </Field>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
