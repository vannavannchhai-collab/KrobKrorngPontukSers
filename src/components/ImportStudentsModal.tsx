import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { api, download } from "../lib/api";
import { Modal, Spinner } from "../components/ui";
import { useToast } from "./Toast";

export function ImportStudentsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<{ created: number; errors: string[]; totalErrors: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const qc = useQueryClient();

  const onFile = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setResult(null);
    setError("");
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ created: number; errors: string[]; totalErrors: number }>("/students/import", {
        method: "POST",
        body: { csv },
      });
      setResult(res);
      if (res.created > 0) {
        toast.success("នាំចូលបានជោគជ័យ", `បានបន្ថែមសិស្ស ${res.created} នាក់`);
        qc.invalidateQueries({ queryKey: ["students"] });
        qc.invalidateQueries({ queryKey: ["meta"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCsv("");
    setResult(null);
    setError("");
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="នាំចូលសិស្សពីឯកសារ CSV"
      description="គាំទ្រឯកសារ Excel/CSV ដែលមានជួរឈរតាមគំរូ"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={() => download("/students/import/template", "student-import-template.csv")}>
            <Download size={15} /> ទាញយកគំរូ
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy || !csv.trim()}>
            {busy ? <Spinner /> : <Upload size={15} />} នាំចូល
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/50 px-4 py-7 text-center transition hover:border-brand-300 hover:bg-brand-50/30"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFile(e.dataTransfer.files?.[0]);
          }}
        >
          <FileSpreadsheet className="mb-2 h-8 w-8 text-brand-500" />
          <p className="text-sm font-medium text-ink-800">អូសឯកសារមកទីនេះ ឬជ្រើសរើសពីកុំព្យូទ័រ</p>
          <p className="mt-1 text-xs text-ink-500">គាំទ្រ .csv (កូដតួអក្សរ UTF-8)</p>
          <button className="btn-secondary btn-sm mt-3" onClick={() => fileRef.current?.click()}>
            ជ្រើសរើសឯកសារ
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>

        <div>
          <label className="label">ឬបិទភ្ជាប់ទិន្នន័យ CSV ដោយផ្ទាល់</label>
          <textarea
            className="input min-h-[130px] font-mono text-[12px]"
            placeholder={"កូដសិស្ស,នាមត្រកូល,នាមខ្លួន,ភេទ (M/F),ថ្ងៃខែឆ្នាំកំណើត (YYYY-MM-DD),ថ្នាក់,..."}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">{error}</div>
        ) : null}

        {result ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
            <p className="text-sm font-semibold text-emerald-800">
              បានបន្ថែមសិស្ស {result.created} នាក់
            </p>
            {result.totalErrors > 0 ? (
              <div className="mt-2">
                <p className="text-xs font-medium text-amber-700">
                  មានបញ្ហា {result.totalErrors} ជួរ:
                </p>
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto text-[11.5px] text-ink-600">
                  {result.errors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl bg-ink-50 p-3 text-[11.5px] leading-relaxed text-ink-500">
          <p className="font-semibold text-ink-700">សេចក្ដីណែនាំ៖</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>ជួរទីមួយត្រូវជាឈ្មោះជួរឈរ (ខ្មែរ ឬអង់គ្លេស)</li>
            <li>«នាមត្រកូល» និង «នាមខ្លួន» ជាកំហិត</li>
            <li>«ថ្នាក់» ត្រូវត្រូវគ្នានឹងឈ្មោះថ្នាក់ដែលមាន (ឧ. 7A)</li>
            <li>ប្រសិនបើកូដសិស្សទទេ ប្រព័ន្ធនឹងបង្កើតដោយស្វ័យប្រវត្តិ</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
