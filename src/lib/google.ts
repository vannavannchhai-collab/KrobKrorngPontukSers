import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import type { User } from "./types";

/** Message channel used by the Google popup callback page. */
export const GOOGLE_MESSAGE = "kps:google-auth";

export interface GoogleStatus {
  enabled: boolean;
  redirect_uri: string | null;
  gmail_only: boolean;
}

/** Human (Khmer) wording for every machine code the server can return. */
export const GOOGLE_ERRORS: Record<string, string> = {
  not_configured:
    "ការចូលប្រើដោយ Google មិនទាន់បានកំណត់នៅម៉ាស៊ីនមេទេ (ត្រូវការ GOOGLE_CLIENT_ID និង GOOGLE_CLIENT_SECRET)។",
  cancelled: "អ្នកបានបោះបង់ការចូលប្រើដោយ Google។",
  state: "សម័យចូលប្រើមិនត្រឹមត្រូវ ឬផុតកំណត់។ សូមព្យាយាមម្ដងទៀត។",
  exchange: "មិនអាចផ្ទៀងផ្ទាត់ជាមួយ Google បានទេ។ សូមព្យាយាមម្ដងទៀត។",
  profile: "មិនអាចអានព័ត៌មានគណនី Google បានទេ។ សូមព្យាយាមម្ដងទៀត។",
  unverified: "អ៊ីមែល Google របស់អ្នកមិនទាន់បានផ្ទៀងផ្ទាត់ទេ។",
  gmail_required:
    "គណនីនេះមិនមែនជា Gmail ទេ។ សូមប្រើអាសយដ្ឋាន @gmail.com សម្រាប់ចូលប្រើប្រព័ន្ធ។",
  not_registered:
    "គណនី Google នេះមិនទាន់មានក្នុងប្រព័ន្ធ។ សូមទាក់ទងអ្នកគ្រប់គ្រងដើម្បីបង្កើតគណនីជាមុន។",
  closed: "ការចុះឈ្មោះគណនីថ្មីត្រូវបានបិទ។ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ។",
  disabled: "គណនីនេះត្រូវបានបិទ។ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ។",
  failed: "ការចូលប្រើដោយ Google បរាជ័យ។ សូមព្យាយាមម្ដងទៀត។",
};

export function googleErrorMessage(code: string | null | undefined): string {
  return GOOGLE_ERRORS[code ?? "failed"] ?? GOOGLE_ERRORS.failed;
}

/**
 * Google sign-in helper.
 *
 * - Outside an iframe: a normal top-level redirect (works everywhere, no popups).
 * - Inside the Arena preview iframe: Google refuses to render inside frames, so a
 *   popup is used and the session is handed back through `postMessage`.
 */
export function useGoogleAuth() {
  const { adopt } = useAuth();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  useEffect(() => {
    let alive = true;
    api<GoogleStatus>("/auth/google/status")
      .then((res) => {
        if (alive) setStatus(res);
      })
      .catch(() => {
        if (alive) setStatus({ enabled: false, redirect_uri: null, gmail_only: true });
      });
    return () => {
      alive = false;
    };
  }, []);

  // Surface errors coming back from a full-page redirect (?google_error=...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("google_error");
    if (!code) return;
    setError(googleErrorMessage(code));
    params.delete("google_error");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
    );
  }, []);

  // Receive the session from the popup.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as
        | { type?: string; ok?: boolean; token?: string; user?: unknown; error?: string }
        | null;
      if (!data || data.type !== GOOGLE_MESSAGE) return;
      setBusy(false);
      if (data.ok && data.token && data.user) {
        adopt(data.token, data.user as User);
      } else {
        setError(googleErrorMessage(data.error));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [adopt]);

  const start = useCallback(() => {
    if (!status?.enabled) {
      setError(googleErrorMessage("not_configured"));
      return;
    }
    setError("");
    setPopupBlocked(false);
    const url = `/api/auth/google/start?next=${encodeURIComponent("/dashboard")}`;
    const inIframe = window.self !== window.top;
    if (!inIframe) {
      window.location.assign(url);
      return;
    }
    setBusy(true);
    const popup = window.open(
      url,
      "kps-google-oauth",
      "width=520,height=680,menubar=no,toolbar=no,location=yes",
    );
    if (!popup) {
      setBusy(false);
      setPopupBlocked(true);
      setError(
        "បង្អួចចូលប្រើ Google ត្រូវបានទប់ស្កាត់ដោយ browser។ សូមបើកប្រព័ន្ធនេះក្នុងផ្ទាំងថ្មី រួចព្យាយាមម្ដងទៀត។",
      );
    }
  }, [status?.enabled]);

  const openInNewTab = useCallback(() => {
    window.open(window.location.href, "_blank", "noopener");
  }, []);

  return { status, error, busy, popupBlocked, start, openInNewTab, setError };
}
