import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { fetchCurrentUser, loginWithGoogle as apiLoginWithGoogle, logout as apiLogout } from "../api/auth";
import type { AuthUser } from "../api/auth";
import { requestGoogleAccessToken } from "../lib/googleAuth";
import { setUnauthorizedHandler } from "../api/http";
import { useToast } from "./ToastContext";

type AuthStatus = "loading" | "unauthenticated" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  loginWithGoogle(): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        setStatus(u ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        setUser(null);
        setStatus("unauthenticated");
      });
  }, []);

  // Fixes a real gap in portifo-web: there, a 401 mid-session (expired
  // cookie) on any screen just shows a generic "Failed to ..." toast and
  // leaves the user staring at a broken screen. Here, any apiFetch 401
  // anywhere in the app resets auth state and bounces back to the login
  // screen instead.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus("unauthenticated");
      showToast("Session expired — please sign in again.", { color: "danger" });
    });
  }, [showToast]);

  const loginWithGoogle = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) throw new Error("Missing VITE_GOOGLE_CLIENT_ID");
    const accessToken = await requestGoogleAccessToken(clientId);
    const loggedInUser = await apiLoginWithGoogle(accessToken);
    setUser(loggedInUser);
    setStatus("authenticated");
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    setStatus("unauthenticated");
  };

  return <AuthContext.Provider value={{ status, user, loginWithGoogle, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
