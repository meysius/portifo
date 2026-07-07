// Plain fetch (not apiFetch) — a 401 from these endpoints means "not logged
// in yet", which is the expected/normal state, not a session expiring.

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export async function loginWithGoogle(accessToken: string): Promise<AuthUser> {
  const res = await fetch("/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (!res.ok) throw new Error("Failed to log in with Google");
  return res.json();
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch("/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch current user");
  return res.json();
}

export async function logout(): Promise<void> {
  const res = await fetch("/auth/logout", { method: "POST" });
  if (!res.ok) throw new Error("Failed to log out");
}
