const DEFAULT_API_BASE_URL = "http://localhost:8080";
const DEFAULT_USER_ID = "1";

type Envelope<T> = { success: boolean; message: string; data: T };
type ErrorEnvelope = { message?: string };

export type UserProfile = {
  userId: number;
  nickname: string;
};

export class UserProfileApiError extends Error {}

function apiBaseUrl() {
  return (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function userId() {
  return import.meta.env?.VITE_HIKE_USER_ID || DEFAULT_USER_ID;
}

async function request(init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/users/me`, {
      ...init,
      headers: {
        "X-User-Id": userId(),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new UserProfileApiError("서버에 연결하지 못했어요.");
  }
  const body = await response.json().catch(() => null) as Envelope<UserProfile> | ErrorEnvelope | null;
  if (response.ok && body && "data" in body) return body.data;
  throw new UserProfileApiError(body?.message ?? "닉네임을 처리하지 못했어요.");
}

export function fetchUserProfile() {
  return request();
}

export function updateUserNickname(nickname: string) {
  return request({ method: "PATCH", body: JSON.stringify({ nickname }) });
}
