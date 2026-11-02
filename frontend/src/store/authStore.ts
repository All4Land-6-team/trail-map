import { useSyncExternalStore } from "react";

const STORAGE_KEY = "trail-map.auth-session";
const listeners = new Set<() => void>();

export type AuthUser = {
  userId: number;
  nickname: string;
  email: string;
};

export type AuthSession = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: AuthUser;
};

function readStoredSession(): AuthSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as AuthSession | null;
    if (!session?.accessToken || !session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

let currentSession = readStoredSession();

function emit() {
  listeners.forEach(listener => listener());
}

export function getAuthSession() {
  return currentSession;
}

export function saveAuthSession(session: AuthSession) {
  currentSession = session;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  emit();
}

export function updateAuthUser(user: AuthUser) {
  if (!currentSession) return;
  saveAuthSession({ ...currentSession, user });
}

export function clearAuthSession() {
  currentSession = null;
  if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  emit();
}

export function useAuthSession() {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    getAuthSession,
    () => null,
  );
}

export function authHeaders(headers?: HeadersInit) {
  const result = new Headers(headers);
  if (currentSession) result.set("Authorization", `Bearer ${currentSession.accessToken}`);
  return Object.fromEntries(result.entries());
}
