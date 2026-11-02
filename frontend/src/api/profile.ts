import { authHeaders } from "../store/authStore.ts";

const DEFAULT_API_BASE_URL = "http://localhost:8080";

export const DEFAULT_NICKNAME = "닉네임";
export const NICKNAME_MAX_LENGTH = 12;

type Envelope<T> = { success: boolean; message: string; data: T };
type ErrorEnvelope = { message?: string };

export type UserProfile = {
  userId: number;
  nickname: string;
  email: string | null;
};

function apiBaseUrl() {
  return (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

async function request(init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/users/me`, {
      ...init,
      headers: authHeaders({
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      }),
    });
  } catch {
    throw new Error("서버에 연결하지 못했어요.");
  }
  const body = await response.json().catch(() => null) as Envelope<UserProfile> | ErrorEnvelope | null;
  if (response.ok && body && "data" in body) return body.data;
  throw new Error(body?.message ?? "닉네임을 처리하지 못했어요.");
}

export function fetchUserProfile() {
  return request();
}

export function updateUserNickname(nickname: string) {
  return request({ method: "PATCH", body: JSON.stringify({ nickname }) });
}
