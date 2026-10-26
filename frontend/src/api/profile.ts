const DEFAULT_API_BASE_URL = "http://localhost:8080";
const DEFAULT_USER_ID = "1";
const USER_ID = import.meta.env?.VITE_HIKE_USER_ID || DEFAULT_USER_ID;

export const DEFAULT_NICKNAME = `익명${USER_ID}`;
export const NICKNAME_MAX_LENGTH = 12;

type Envelope<T> = { success: boolean; message: string; data: T };
type ErrorEnvelope = { message?: string };

export type UserProfile = {
  userId: number;
  nickname: string;
};

function apiBaseUrl() {
  return (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

async function request(init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/users/me`, {
      ...init,
      headers: {
        "X-User-Id": USER_ID,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
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
