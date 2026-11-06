import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { GOOGLE_MESSAGE, googleErrorMessage } from "../lib/google";
import { GoogleGlyph } from "../components/GoogleButton";
import type { User } from "../lib/types";

interface ExchangeResponse {
  token: string;
  user: User;
  first_account: boolean;
}

/**
 * Landing page after Google's consent screen.
 *
 * In a popup it hands the session to the opener window and closes itself;
 * with a normal redirect it stores the session and continues inside the app.
 */
export default function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const { adopt } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get("code") ?? "";
    const next = params.get("next") || "/dashboard";
    const isPopup = Boolean(window.opener) && window.opener !== window;

    const finishPopup = (payload: Record<string, unknown>) => {
      if (!isPopup) return false;
      try {
        window.opener.postMessage(payload, window.location.origin);
      } catch {
        /* ignore */
      }
      window.close();
      return true;
    };

    if (!code) {
      const codeParam = params.get("error");
      const message = googleErrorMessage(codeParam);
      if (!finishPopup({ type: GOOGLE_MESSAGE, ok: false, error: codeParam ?? "failed" })) {
        setError(message);
      }
      return;
    }

    api<ExchangeResponse>("/auth/google/exchange", { method: "POST", body: { code } })
      .then((res) => {
        if (finishPopup({ type: GOOGLE_MESSAGE, ok: true, token: res.token, user: res.user })) return;
        adopt(res.token, res.user);
        navigate(res.first_account ? "/setup" : next, { replace: true });
      })
      .catch((err: Error) => {
        if (finishPopup({ type: GOOGLE_MESSAGE, ok: false, error: "failed" })) return;
        setError(err.message || googleErrorMessage("failed"));
      });
  }, [adopt, navigate, params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-5 py-12">
      <div className="w-full max-w-[420px] animate-slide-up rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-200 bg-white shadow-sm">
          <GoogleGlyph size={24} />
        </div>

        {error ? (
          <>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertCircle size={20} />
            </div>
            <h1 className="text-[19px] font-bold text-ink-950">ការចូលប្រើដោយ Google មិនបានសម្រេច</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{error}</p>
            <Link
              to="/login"
              className="btn-secondary btn-sm mt-6 w-full justify-center text-[12.5px]"
            >
              <ArrowLeft size={14} /> ត្រឡប់ទៅការចូលប្រើ
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-[19px] font-bold text-ink-950">កំពុងបញ្ចប់ការចូលប្រើ…</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
              សូមរង់ចាំមួយសន្ទុះ ប្រព័ន្ធកំពុងផ្ទៀងផ្ទាត់គណនី Google របស់អ្នក។
            </p>
            <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-ink-100">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-500" />
            </div>
          </>
        )}

        <p className="mt-8 text-[11px] text-ink-400">
          រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ <span className="font-semibold text-ink-600">វណ្ណា វណ្ណឆៃ</span>
        </p>
      </div>
    </div>
  );
}
