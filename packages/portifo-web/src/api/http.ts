// Shared fetch wrapper for endpoints that require an authenticated session.
// A 401 here means the session cookie expired mid-use (not "never logged
// in" — that case is handled separately by api/auth.ts's fetchCurrentUser),
// so it's treated as a global event: notify whoever registered a handler
// (AuthContext resets to "unauthenticated" and shows a toast) rather than
// letting each call site show its own generic error.

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler): void {
  unauthorizedHandler = fn;
}

// Active portfolio, set by PortfolioDataContext. Sent on every request so the
// backend scopes data to it (falls back server-side to the first portfolio).
let activePortfolioId: string | null = null;

export function setActivePortfolioId(id: string | null): void {
  activePortfolioId = id;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (activePortfolioId) headers.set("X-Portfolio-Id", activePortfolioId);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    unauthorizedHandler?.();
    throw new UnauthorizedError();
  }
  return res;
}
