import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { cn } from "../lib/utils";

const GMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]{1,62})@(?:gmail\.com|googlemail\.com)$/;

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { data: status } = useQuery({
    queryKey: ["registration-status"],
    queryFn: () =>
      api<{ has_users: boolean; allow_registration: boolean; users: number }>("/auth/registration-status"),
  });

  if (user) return <Navigate to="/dashboard" replace />;

  const emailOk = GMAIL_RE.test(email.trim().toLowerCase());
  const passwordOk = password.length >= 8;
  const matchOk = password.length > 0 && password === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("សូមបញ្ចូលឈ្មោះពេញរបស់អ្នក");
    if (!emailOk) return setError("សូមប្រើអាសយដ្ឋាន Gmail ពិតប្រាកដ (ឧ. yourname@gmail.com)");
    if (!passwordOk) return setError("លេខសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ");
    if (!matchOk) return setError("លេខសម្ងាត់ទាំងពីរមិនត្រូវគ្នា");
    if (!accept) return setError("សូមយល់ព្រមលើលក្ខខណ្ឌប្រើប្រាស់");

    setBusy(true);
    try {
      const res = await register({ name: name.trim(), email: email.trim().toLowerCase(), password });
      toast.success(
        res.firstAccount ? "បានបង្កើតគណនីម្ចាស់ប្រព័ន្ធ" : "បានបង្កើតគណនីរួចរាល់",
        res.firstAccount
          ? "សូមរៀបចំព័ត៌មានសាលា ឆ្នាំសិក្សា និងមុខវិជ្ជាជាមុន"
          : "អ្នកគ្រប់គ្រងនឹងចាត់តាំងថ្នាក់ និងមុខវិជ្ជាឱ្យអ្នក",
      );
      navigate(res.firstAccount ? "/setup" : "/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message ?? "ការចុះឈ្មោះបរាជ័យ");
    } finally {
      setBusy(false);
    }
  };

  const firstAccount = status ? !status.has_users : false;
  const registrationClosed = status ? status.has_users && !status.allow_registration : false;

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-ink-950 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, #38bdf8 0, transparent 45%), radial-gradient(circle at 85% 35%, #3462f5 0, transparent 40%), radial-gradient(circle at 45% 95%, #14b8a6 0, transparent 45%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-sky-300 text-xl font-bold text-ink-950 shadow-lg">
            ក
          </div>
          <div>
            <p className="text-[15px] font-semibold">ប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស</p>
            <p className="text-xs text-ink-400">KrobKrorng Pontuk Sers</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[30px] font-bold leading-[1.4] tracking-tight">
            បង្កើតគណនីពិត
            <br />
            <span className="bg-gradient-to-r from-sky-300 to-brand-300 bg-clip-text text-transparent">
              ដោយប្រើអ៊ីមែល Gmail
            </span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-300">
            គ្មានគណនីសាកល្បង គ្មានទិន្នន័យគំរូ។ គណនីដំបូងដែលចុះឈ្មោះនឹងក្លាយជា
            ម្ចាស់ប្រព័ន្ធ (អ្នកគ្រប់គ្រង) ហើយមានសិទ្ធិពេញលេញលើទិន្នន័យសាលារបស់អ្នក។
          </p>
          <ul className="mt-6 space-y-2 text-[12.5px] text-ink-300">
            {[
              "ចុះឈ្មោះ និងចូលប្រើដោយអ៊ីមែល Gmail",
              "ពាក្យសម្ងាត់ដាក់កូដសុវត្ថិភាព (scrypt) មិនអាចអានបាន",
              "គណនីគ្រូបង្រៀនចុះឈ្មោះបាន ហើយរង់ចាំការចាត់តាំងពីអ្នកគ្រប់គ្រង",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] leading-relaxed text-ink-500">
          © {new Date().getFullYear()} រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ វណ្ណា វណ្ណឆៃ
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[440px] animate-slide-up">
          <Link to="/login" className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 hover:text-ink-800">
            <ArrowLeft size={14} /> ត្រឡប់ទៅការចូលប្រើ
          </Link>

          <div className="mb-5 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-brand-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">
              {firstAccount ? "បង្កើតគណនីម្ចាស់ប្រព័ន្ធ" : "ចុះឈ្មោះគណនីថ្មី"}
            </span>
          </div>
          <h1 className="text-[26px] font-bold leading-tight text-ink-950">ចុះឈ្មោះដោយ Gmail</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            {firstAccount
              ? "អ្នកនឹងក្លាយជាអ្នកគ្រប់គ្រងដំបូង ដែលមានសិទ្ធិពេញលេញលើប្រព័ន្ធ។"
              : "គណនីថ្មីនឹងទទួលបានតួនាទីជាគ្រូបង្រៀន រង់ចាំការចាត់តាំងថ្នាក់ពីអ្នកគ្រប់គ្រង។"}
          </p>

          {registrationClosed ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
              ការចុះឈ្មោះគណនីថ្មីត្រូវបានបិទដោយអ្នកគ្រប់គ្រង។ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ
              ដើម្បីបង្កើតគណនីជំនួសអ្នក។
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="ឈ្មោះពេញ" required>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    className="input pl-9"
                    placeholder="វណ្ណា វណ្ណឆៃ"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    autoFocus
                  />
                </div>
              </Field>

              <Field
                label="អ៊ីមែល Gmail"
                required
                hint="ត្រូវតែជាអាសយដ្ឋាន @gmail.com"
                error={email.length > 3 && !emailOk ? "អ៊ីមែលត្រូវតែបញ្ចប់ដោយ @gmail.com" : undefined}
              >
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    className={cn("input pl-9", email.length > 3 && !emailOk && "border-rose-300")}
                    type="email"
                    placeholder="yourname@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </Field>

              <Field label="លេខសម្ងាត់" required hint="យ៉ាងតិច ៨ តួអក្សរ">
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    className="input px-9"
                    type={show ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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

              <Field
                label="បញ្ជាក់លេខសម្ងាត់"
                required
                error={confirm.length > 0 && !matchOk ? "លេខសម្ងាត់ទាំងពីរមិនត្រូវគ្នា" : undefined}
              >
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    className={cn("input pl-9", confirm.length > 0 && !matchOk && "border-rose-300")}
                    type={show ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </Field>

              <label className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-600">
                <input
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => setAccept(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600"
                />
                <span>
                  ខ្ញុំយល់ព្រមថាទិន្នន័យដែលបញ្ចូលជាកម្មសិទ្ធិរបស់សាលាខ្ញុំ និងរក្សាទុកដោយសុវត្ថិភាពក្នុងប្រព័ន្ធនេះ។
                </span>
              </label>

              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
                  {error}
                </div>
              ) : null}

              <button type="submit" className="btn-primary w-full py-2.5 text-sm" disabled={busy}>
                {busy ? <Spinner /> : <ShieldCheck size={15} />}
                បង្កើតគណនី
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-[12px] text-ink-500">
            មានគណនីរួចហើយ?{" "}
            <Link to="/login" className="font-semibold text-brand-700 hover:underline">
              ចូលប្រើប្រព័ន្ធ
            </Link>
          </p>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-ink-400">
            រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ <span className="font-semibold text-ink-600">វណ្ណា វណ្ណឆៃ</span>
          </p>
        </div>
      </div>
    </div>
  );
}
