import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  BarChart3,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Field, Spinner } from "../components/ui";

const HIGHLIGHTS = [
  { icon: BarChart3, title: "របាយការណ៍ពិន្ទុរស់រវើក", text: "តាមដានមធ្យមភាគ និទ្ទេស និងចំណាត់ថ្នាក់ភ្លាមៗ" },
  { icon: BookOpen, title: "គ្រប់គ្រងគ្រប់ផ្នែក", text: "សិស្ស ថ្នាក់ មុខវិជ្ជា ពិន្ទុ និងវត្តមានក្នុងកន្លែងតែមួយ" },
  { icon: ShieldCheck, title: "សិទ្ធិប្រើប្រាស់ច្បាស់លាស់", text: "អ្នកគ្រប់គ្រង និងគ្រូបង្រៀនមានសិទ្ធិខុសៗគ្នា" },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { data: regStatus } = useQuery({
    queryKey: ["registration-status"],
    queryFn: () =>
      api<{ has_users: boolean; allow_registration: boolean; users: number }>("/auth/registration-status"),
  });

  if (user) return <Navigate to={location.state?.from ?? "/dashboard"} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("សូមបញ្ចូលឈ្មោះអ្នកប្រើ និងលេខសម្ងាត់");
      return;
    }
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from ?? "/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message ?? "ការចូលប្រើប្រាស់បរាជ័យ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Brand panel */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-ink-950 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #38bdf8 0, transparent 45%), radial-gradient(circle at 80% 30%, #3462f5 0, transparent 40%), radial-gradient(circle at 50% 90%, #14b8a6 0, transparent 45%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-sky-300 text-xl font-bold text-ink-950 shadow-lg">
              ក
            </div>
            <div>
              <p className="text-[15px] font-semibold">ប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស</p>
              <p className="text-xs text-ink-400">KrobKrorng Pontuk Sers · v1.0</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-[34px] font-bold leading-[1.35] tracking-tight">
            គ្រប់គ្រងលទ្ធផលសិក្សា
            <br />
            <span className="bg-gradient-to-r from-sky-300 to-brand-300 bg-clip-text text-transparent">
              ដោយទំនុកចិត្ត និងភាពច្បាស់លាស់
            </span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-300">
            ប្រព័ន្ធពេញលេញសម្រាប់សាលារៀន៖ គ្រប់គ្រងសិស្ស គ្រូបង្រៀន ថ្នាក់ មុខវិជ្ជា
            បញ្ចូលពិន្ទុ គណនាមធ្យមភាគស្វ័យប្រវត្តិ និងបោះពុម្ពសៀវភៅពិន្ទុបានភ្លាមៗ។
          </p>
          <div className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <h.icon size={17} className="text-sky-300" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white">{h.title}</p>
                  <p className="text-[11.5px] text-ink-400">{h.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-ink-500">
          © {new Date().getFullYear()} រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ វណ្ណា វណ្ណឆៃ
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px] animate-slide-up">
          <div className="mb-7 lg:hidden">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-ink-950 text-lg font-bold text-white">
              ក
            </div>
            <h1 className="text-xl">ប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស</h1>
          </div>

          <div className="mb-6 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-brand-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">
              ចូលប្រើប្រព័ន្ធ
            </span>
          </div>
          <h1 className="text-[26px] font-bold leading-tight text-ink-950">សូមស្វាគមន៍ត្រឡប់មកវិញ</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            ចូលដោយគណនី Gmail ពិតរបស់អ្នក ដើម្បីបន្តការងារគ្រប់គ្រងពិន្ទុសិស្ស។
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="អ៊ីមែល (Gmail)" required>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  className="input pl-9"
                  placeholder="yourname@gmail.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </Field>

            <Field label="លេខសម្ងាត់" required>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  className="input px-9"
                  type={show ? "text" : "password"}
                  placeholder="បញ្ចូលលេខសម្ងាត់"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"
                  aria-label={show ? "លាក់លេខសម្ងាត់" : "បង្ហាញលេខសម្ងាត់"}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
                {error}
              </div>
            ) : null}

            <button type="submit" className="btn-primary w-full py-2.5 text-sm" disabled={busy}>
              {busy ? <Spinner /> : <Lock size={15} />}
              ចូលប្រើប្រព័ន្ធ
            </button>
          </form>

          <div className="mt-7 rounded-xl border border-ink-200 bg-white p-4 text-center">
            <p className="text-[12.5px] font-semibold text-ink-800">
              {regStatus?.has_users === false
                ? "មិនទាន់មានគណនីនៅក្នុងប្រព័ន្ធនេះទេ"
                : "មិនទាន់មានគណនី? ចុះឈ្មោះដោយ Gmail"}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
              {regStatus?.has_users === false
                ? "ចុះឈ្មោះគណនីដំបូង ដើម្បីក្លាយជាម្ចាស់ និងអ្នកគ្រប់គ្រងប្រព័ន្ធ។"
                : "គណនីគ្រូបង្រៀនអាចចុះឈ្មោះបាន ហើយរង់ចាំការចាត់តាំងពីអ្នកគ្រប់គ្រង។"}
            </p>
            {regStatus && regStatus.has_users && !regStatus.allow_registration ? (
              <p className="mt-2 text-[11px] text-amber-700">
                ការចុះឈ្មោះត្រូវបានបិទ — សូមទាក់ទងអ្នកគ្រប់គ្រង។
              </p>
            ) : (
              <Link
                to="/register"
                className="btn-secondary btn-sm mt-3 w-full justify-center border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300 hover:bg-brand-100"
              >
                <UserPlus size={14} /> ចុះឈ្មោះដោយ Gmail
              </Link>
            )}
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-400">
            ប្រសិនបើអ្នកភ្លេចលេខសម្ងាត់ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធរបស់សាលា។
          </p>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-400">
            រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ <span className="font-semibold text-ink-600">វណ្ណា វណ្ណឆៃ</span>
          </p>
        </div>
      </div>
    </div>
  );
}
