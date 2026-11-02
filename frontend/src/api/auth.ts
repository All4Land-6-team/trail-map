import {
  authHeaders,
  clearAuthSession,
  getAuthSession,
  type AuthSession,
  type AuthUser,
} from "../store/authStore.ts";

const DEFAULT_API_BASE_URL = "http://localhost:8080";

type Envelope<T> = { data: T };
type ErrorEnvelope = { message?: string };

export class AuthApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function apiBaseUrl() {
  return (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/auth${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(authenticated ? authHeaders(init.headers) : init.headers),
      },
    });
  } catch {
    throw new AuthApiError(0, "서버에 연결하지 못했어요.");
  }
  const body = await response.json().catch(() => null) as Envelope<T> | ErrorEnvelope | null;
  if (response.ok && body && "data" in body) return body.data;
  if (authenticated && response.status === 401) clearAuthSession();
  const message = body && "message" in body ? body.message : undefined;
  throw new AuthApiError(response.status, message ?? "요청을 처리하지 못했어요.");
}

export function signup(nickname: string, email: string, password: string) {
  return request<AuthSession>("/signup", {
    method: "POST",
    body: JSON.stringify({ nickname, email, password }),
  });
}

export function login(email: string, password: string) {
  return request<AuthSession>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchCurrentUser() {
  return request<AuthUser>("/me", {}, true);
}

export async function logout() {
  if (!getAuthSession()) return;
  try {
    await request<null>("/logout", { method: "POST" }, true);
  } finally {
    clearAuthSession();
  }
}
