import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

type ToastTone = "success" | "error" | "info" | "warning";
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let counter = 0;

const TONE_STYLES: Record<ToastTone, { icon: typeof CheckCircle2; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2, ring: "border-emerald-200", iconColor: "text-emerald-600" },
  error: { icon: XCircle, ring: "border-rose-200", iconColor: "text-rose-600" },
  info: { icon: Info, ring: "border-brand-200", iconColor: "text-brand-600" },
  warning: { icon: AlertTriangle, ring: "border-amber-200", iconColor: "text-amber-600" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = ++counter;
      setItems((prev) => [...prev.slice(-3), { id, title, description, tone }]);
      setTimeout(() => remove(id), tone === "error" ? 6500 : 4200);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      info: (t, d) => push("info", t, d),
      warning: (t, d) => push("warning", t, d),
    }),
    [push],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail;
      if (detail?.message) push("error", detail.message);
    };
    window.addEventListener("kps:toast-error", handler);
    return () => window.removeEventListener("kps:toast-error", handler);
  }, [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(92vw,380px)] flex-col gap-2.5 no-print">
        {items.map((item) => {
          const style = TONE_STYLES[item.tone];
          const Icon = style.icon;
          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white/95 p-3.5 shadow-pop backdrop-blur animate-slide-up",
                style.ring,
              )}
              role="status"
            >
              <Icon className={cn("mt-0.5 shrink-0", style.iconColor)} size={18} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{item.description}</p>
                ) : null}
              </div>
              <button
                onClick={() => remove(item.id)}
                className="rounded-md p-0.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                aria-label="បិទ"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
