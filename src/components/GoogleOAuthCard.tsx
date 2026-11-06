import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, ExternalLink, Eye, EyeOff, KeyRound, Save, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "./Toast";
import { Spinner } from "./ui";
import { cn } from "../lib/utils";

interface GoogleAdminInfo {
  enabled: boolean;
  source: "env" | "settings" | null;
  client_id: string;
  client_id_masked: string;
  has_secret: boolean;
  managed_by_env: boolean;
  redirect_uri: string;
  redirect_uri_override: string;
  suggested_redirect_uri: string;
}

/**
 * Admin card that connects the app to Google Cloud without shell access:
 * paste the OAuth Client ID / Secret, copy the redirect URI, done.
 */
export function GoogleOAuthCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["google-admin"],
    queryFn: () => api<GoogleAdminInfo>("/admin/google"),
  });

  useEffect(() => {
    if (!data) return;
    setClientId(data.client_id ?? "");
    setRedirectUri(data.redirect_uri_override ?? "");
  }, [data?.client_id, data?.redirect_uri_override]);

  const save = useMutation({
    mutationFn: () =>
      api<GoogleAdminInfo>("/admin/google", {
        method: "PUT",
        body: {
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          redirect_uri: redirectUri.trim(),
        },
      }),
    onSuccess: (res) => {
      setClientSecret("");
      qc.invalidateQueries({ queryKey: ["google-admin"] });
      qc.invalidateQueries({ queryKey: ["google-status"] });
      toast.success(
        res.enabled ? "បានបើកការចូលប្រើដោយ Google" : "បានរក្សាទុក",
        res.enabled
          ? "ប៊ូតុង «ចូលប្រើដោយ Google» នឹងបង្ហាញនៅទំព័រចូលប្រើភ្លាមៗ"
          : "សូមបញ្ចូល Client Secret ដើម្បីបើកដំណើរការ",
      );
    },
    onError: (e: Error) => toast.error("រក្សាទុកមិនបានសម្រេច", e.message),
  });

  const disable = useMutation({
    mutationFn: () => api("/admin/google", { method: "DELETE" }),
    onSuccess: () => {
      setClientSecret("");
      qc.invalidateQueries({ queryKey: ["google-admin"] });
      qc.invalidateQueries({ queryKey: ["google-status"] });
      toast.success("បានបិទ Google OAuth", "ប៊ូតុង Google ត្រូវបានលាក់ចេញពីទំព័រចូលប្រើ");
    },
    onError: (e: Error) => toast.error("បិទមិនបានសម្រេច", e.message),
  });

  const copyRedirect = () => {
    navigator.clipboard?.writeText(data?.redirect_uri ?? "");
    toast.success("បានចម្លងតំណភ្ជាប់", "ដាក់ក្នុង Authorized redirect URIs នៅ Google Cloud Console");
  };

  return (
    <div className="sm:col-span-2 rounded-xl border border-ink-200 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
            <KeyRound size={15} />
          </span>
          <div>
            <p className="text-[12.5px] font-semibold text-ink-800">ចូលប្រើដោយ Google (OAuth)</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
              គណនី Gmail អាចចូលប្រើដោយ Google ដោយមិនចាំបាច់វាយលេខសម្ងាត់។
              បញ្ចូល Client ID និង Client Secret ពី Google Cloud Console ខាងក្រោម។
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
            data?.enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
          )}
        >
          {data?.enabled ? "បានបើក" : "មិនទាន់បើក"}
        </span>
      </div>

      {/* Redirect URI — needed BEFORE saving credentials in Google Console */}
      <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/50 p-2.5">
        <p className="text-[10.5px] font-semibold text-brand-800">
          ១. ចម្លងតំណនេះទៅដាក់ក្នុង Authorized redirect URIs
        </p>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-white px-2 py-1 text-[11px] text-ink-700">
            {isLoading ? "កំពុងផ្ទុក…" : data?.redirect_uri}
          </code>
          <button type="button" className="btn-ghost btn-sm shrink-0" onClick={copyRedirect}>
            <Copy size={12} /> ចម្លង
          </button>
        </div>
      </div>

      {data?.managed_by_env ? (
        <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3 text-[11.5px] leading-relaxed text-ink-600">
          ការកំណត់នេះកំពុងមកពី <code className="rounded bg-white px-1">environment variables</code>{" "}
          (<code className="rounded bg-white px-1">GOOGLE_CLIENT_ID</code> /{" "}
          <code className="rounded bg-white px-1">GOOGLE_CLIENT_SECRET</code>)។
          ដើម្បីកែ សូមកែនៅម៉ាស៊ីនមេ។
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Client ID</span>
              <input
                className="input"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="1234567890-abc123.apps.googleusercontent.com"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="block">
              <span className="label">Client Secret</span>
              <div className="relative">
                <input
                  className="input pr-9"
                  type={showSecret ? "text" : "password"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={data?.has_secret ? "•••••••• (ទុកទទេ = រក្សាតម្លៃចាស់)" : "GOCSPX-…"}
                  autoComplete="new-password"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"
                  aria-label={showSecret ? "លាក់" : "បង្ហាញ"}
                >
                  {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {data?.has_secret ? (
                <span className="hint flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-emerald-600" /> មាន Client Secret រក្សាទុករួចហើយ
                </span>
              ) : null}
            </label>
          </div>

          <label className="mt-3 block">
            <span className="label">Redirect URI (ស្រេចចិត្ត)</span>
            <input
              className="input"
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              placeholder={data?.suggested_redirect_uri ?? ""}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="hint">
              បើទុកទទេ ប្រព័ន្ធប្រើតម្លៃស្វ័យប្រវត្តិ៖{" "}
              <code className="text-ink-600">{data?.suggested_redirect_uri}</code> — កែតែពេល host
              ខាងក្រៅខុសពី host ដែល browser កំពុងប្រើ។
            </span>
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => save.mutate()}
              disabled={save.isPending || !clientId.trim()}
            >
              {save.isPending ? <Spinner /> : <Save size={14} />} រក្សាទុក និងបើកដំណើរការ
            </button>
            {data?.enabled ? (
              <button
                type="button"
                className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  if (confirm("បិទការចូលប្រើដោយ Google ហើយលុប Client ID/Secret ចេញ?")) disable.mutate();
                }}
                disabled={disable.isPending}
              >
                <Trash2 size={14} /> បិទ Google OAuth
              </button>
            ) : null}
            <span className="text-[10.5px] text-ink-400">
              Client Secret ត្រូវបានអ៊ិនគ្រីប (AES-256-GCM) មុនពេលរក្សាទុក
            </span>
          </div>
        </>
      )}

      <details className="mt-3 rounded-lg border border-ink-200 bg-ink-50/50 p-3">
        <summary className="cursor-pointer text-[11.5px] font-medium text-ink-700">
          របៀបបង្កើត Client ID នៅ Google Cloud Console (ជំហានលម្អិត)
        </summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-ink-600">
          <li>
            ចូល{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-brand-700 hover:underline"
            >
              Google Cloud Console → Credentials <ExternalLink size={10} />
            </a>{" "}
            (បង្កើត project ថ្មីបើចាំបាច់)
          </li>
          <li>
            <b>Create credentials → OAuth client ID</b> → Application type: <b>Web application</b>
          </li>
          <li>
            នៅ <b>Authorized redirect URIs</b> → បិទភ្ជាប់តំណដែលបានចម្លងខាងលើ (ត្រូវដូចគ្នា ១០០%)
          </li>
          <li>ចម្លង <b>Client ID</b> និង <b>Client secret</b> មកបំពេញខាងលើ → រក្សាទុក</li>
          <li>
            បើ app នៅក្នុង <b>Testing</b> mode → បន្ថែមអ៊ីមែលរបស់អ្នកនៅ{" "}
            <b>OAuth consent screen → Test users</b> (បើអត់ នឹងឃើញ “Access blocked”)
          </li>
        </ol>
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[10.5px] leading-relaxed text-amber-800">
          បើកម្មវិធីក្នុង Live Preview (iframe) Google មិនអនុញ្ញាត consent ក្នុង frame ទេ —
          ប្រព័ន្ធនឹងបើកជា popup។ បើ popup ត្រូវបានទប់ស្កាត់ សូមបើកប្រព័ន្ធក្នុងផ្ទាំងថ្មី។
        </p>
      </details>
    </div>
  );
}
