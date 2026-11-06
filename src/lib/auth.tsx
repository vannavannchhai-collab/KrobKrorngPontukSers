import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, cachedUser, clearSession, getToken, setSession } from "./api";
import type { User } from "./types";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<{ user: User; firstAccount: boolean }>;
  /** Adopt a session issued elsewhere (e.g. the Google OAuth popup). */
  adopt: (token: string, nextUser: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (getToken() ? cachedUser<User>() : null));
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    let mounted = true;
    api<{ user: User }>("/auth/me")
      .then((res) => {
        if (mounted) setUser(res.user);
      })
      .catch(() => {
        if (mounted) {
          clearSession();
          setUser(null);
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("kps:unauthorized", onUnauthorized);
    return () => window.removeEventListener("kps:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    setSession(res.token, res.user);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await api<{ token: string; user: User; first_account: boolean }>("/auth/register", {
      method: "POST",
      body: input,
    });
    setSession(res.token, res.user);
    setUser(res.user);
    return { user: res.user, firstAccount: res.first_account };
  }, []);

  const adopt = useCallback((token: string, nextUser: User) => {
    setSession(token, nextUser);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, adopt, logout }),
    [user, loading, login, register, adopt, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
