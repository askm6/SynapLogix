/** Minimal fetch wrapper for the FastAPI backend (section 5.6: 400, 404, 422 and 500 carry a message and a field). */

export class ApiError extends Error {
  readonly status: number;
  readonly field?: string;

  constructor(status: number, message: string, field?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
  }
}

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

type Query = Record<string, string | number | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (!response.ok) {
    // FastAPI returns {"detail": "..."} or {"detail": {"message": "...", "field": "..."}}.
    let message = response.statusText;
    let field: string | undefined;
    try {
      const data = await response.json();
      const detail = data?.detail;
      if (typeof detail === 'string') message = detail;
      else if (detail && typeof detail === 'object') {
        message = detail.message ?? message;
        field = detail.field;
      }
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(response.status, message, field);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
