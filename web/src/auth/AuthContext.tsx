import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, getStoredToken, storeToken } from "../api/client";
import type { User } from "../types";

type AuthState = "loading" | "authenticated" | "unauthenticated" | "unavailable";
interface AuthContextValue {
  user: User | null;
  state: AuthState;
  signIn(user: User): void;
  signOut(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AuthState>(() => getStoredToken() ? "loading" : "unauthenticated");
  const userRef = useRef(user);
  const stateRef = useRef(state);
  userRef.current = user;
  stateRef.current = state;

  const signIn = useCallback((authenticatedUser: User) => {
    storeToken(authenticatedUser.token);
    setUser(authenticatedUser);
    setState("authenticated");
  }, []);

  const signOut = useCallback(() => {
    storeToken(null);
    setUser(null);
    setState("unauthenticated");
  }, []);

  useEffect(() => {
    let active = true;
    const token = getStoredToken();
    if (!token) {
      setState("unauthenticated");
    } else {
      api.currentUser()
        .then(({ user: current }) => {
          if (active) {
            setUser(current);
            setState("authenticated");
          }
        })
        .catch(() => {
          if (active) {
            setUser(null);
            setState("unauthenticated");
          }
        });
    }
    const handleAuthChange = () => {
      if (!getStoredToken()) {
        setUser(null);
        setState("unauthenticated");
      }
    };
    const handleStorageUnavailable = () => setState("unavailable");
    window.addEventListener("conduit:auth-changed", handleAuthChange);
    window.addEventListener("conduit:storage-unavailable", handleStorageUnavailable);
    return () => {
      active = false;
      window.removeEventListener("conduit:auth-changed", handleAuthChange);
      window.removeEventListener("conduit:storage-unavailable", handleStorageUnavailable);
    };
  }, []);

  useEffect(() => {
    window.__conduit_debug__ = {
      getToken: getStoredToken,
      getAuthState: () => stateRef.current,
      getCurrentUser: () => userRef.current
    };
    return () => {
      delete window.__conduit_debug__;
    };
  }, []);

  const value = useMemo(() => ({ user, state, signIn, signOut }), [user, state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
