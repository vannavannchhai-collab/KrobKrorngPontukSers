import { HttpError } from "./db";
import { csvFor, handleLocal, type ApiRequest } from "./localapi";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  query?: Record<string, string | number | null | undefined | boolean>;
  signal?: AbortSignal;
};

function toQuery(query?: Options["query"]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!query) return out;
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = String(v);
  }
  return out;
}

/**
 * Every call is resolved locally against the browser data store — there is no
 * network request anymore. The signature is unchanged so pages stay untouched.
 */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const request: ApiRequest = {
    method: opts.method ?? "GET",
    path,
    query: toQuery(opts.query),
    body: (opts.body as Record<string, unknown>) ?? {},
  };
  try {
    return handleLocal(request) as T;
  } catch (err) {
    if (err instanceof HttpError) throw new ApiError(err.status, err.message);
    if (err instanceof Error) throw new ApiError(500, err.message);
    throw new ApiError(500, "មានបញ្ហាមិនស្គាល់");
  }
}

/** Save a generated CSV file to the user's device (no server involved). */
export async function download(path: string, fallbackName: string) {
  const [rawPath, rawQuery = ""] = path.split("?");
  const query: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(rawQuery)) query[k] = v;

  let csv: string;
  let filename = fallbackName;
  try {
    const out = csvFor(rawPath, query);
    csv = out.csv;
    filename = out.filename;
  } catch (err) {
    throw new ApiError(err instanceof HttpError ? err.status : 500, (err as Error).message);
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
