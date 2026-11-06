import clsx, { type ClassValue } from "clsx";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export const KHMER_MONTHS = [
  "មករា",
  "កុម្ភៈ",
  "មីនា",
  "មេសា",
  "ឧសភា",
  "មិថុនា",
  "កក្កដា",
  "សីហា",
  "កញ្ញា",
  "តុលា",
  "វិច្ឆិកា",
  "ធ្នូ",
];

export const KHMER_WEEKDAYS = ["អាទិត្យ", "ចន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];

export function formatDateKhmer(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `ថ្ងៃទី ${d.getDate()} ខែ${KHMER_MONTHS[d.getMonth()]} ឆ្នាំ ${d.getFullYear()}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function gradeTone(grade: string | null | undefined): string {
  switch (grade) {
    case "A":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "B":
      return "bg-sky-50 text-sky-700 border border-sky-200";
    case "C":
      return "bg-indigo-50 text-indigo-700 border border-indigo-200";
    case "D":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "E":
      return "bg-orange-50 text-orange-700 border border-orange-200";
    case "F":
      return "bg-rose-50 text-rose-700 border border-rose-200";
    default:
      return "bg-ink-100 text-ink-600 border border-ink-200";
  }
}

export function scoreTone(score: number | null | undefined, passMark = 50): string {
  if (score === null || score === undefined) return "text-ink-400";
  if (score >= 90) return "text-emerald-600";
  if (score >= passMark) return "text-ink-800";
  return "text-rose-600";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(-2)
    .map((p) => p.charAt(0))
    .join("");
}

export function genderLabel(gender: string | null | undefined): string {
  return gender === "M" ? "ប្រុស" : gender === "F" ? "ស្រី" : "—";
}

export function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "កំពុងសិក្សា";
    case "inactive":
      return "ផ្អាក";
    case "graduated":
      return "បានបញ្ចប់";
    case "transferred":
      return "ផ្ទេរចេញ";
    default:
      return "—";
  }
}

export function attendanceLabel(status: string): string {
  switch (status) {
    case "present":
      return "វត្តមាន";
    case "absent":
      return "អវត្តមាន";
    case "late":
      return "មកយឺត";
    case "permission":
      return "សុំច្បាប់";
    default:
      return status;
  }
}

export function classDisplay(grade?: number | null, name?: string | null): string {
  if (!name) return "—";
  return grade ? `ថ្នាក់ទី${grade}${name}` : name;
}

export function pluckName(student: { name_kh?: string; last_name_kh?: string; first_name_kh?: string }) {
  return student.name_kh ?? `${student.last_name_kh ?? ""} ${student.first_name_kh ?? ""}`.trim();
}

export function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function downloadBlob(content: string, filename: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
