import { useSyncExternalStore } from "react";

// 사용자 API가 생기기 전까지 닉네임을 브라우저에 저장한다. 산 · 코스 · 스팟 후기 작성자 이름으로 쓴다.
// 중복 닉네임은 검사하지 않는다.
export const DEFAULT_NICKNAME = "익명";
export const NICKNAME_MAX_LENGTH = 12;
const STORAGE_KEY = "trail-map:nickname";

function readStoredNickname() {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || DEFAULT_NICKNAME;
  } catch {
    return DEFAULT_NICKNAME;
  }
}

let nickname = typeof window === "undefined" ? DEFAULT_NICKNAME : readStoredNickname();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useNickname() {
  return useSyncExternalStore(subscribe, () => nickname, () => DEFAULT_NICKNAME);
}

/** 후기 저장처럼 화면 밖에서 현재 닉네임이 필요할 때 쓴다. */
export function getNickname() {
  return nickname;
}

/** 앞뒤 공백을 지우고 저장한다. 비우면 기본값(익명)으로 돌아간다. */
export function saveNickname(value: string) {
  nickname = value.trim().slice(0, NICKNAME_MAX_LENGTH) || DEFAULT_NICKNAME;
  try {
    localStorage.setItem(STORAGE_KEY, nickname);
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 이번 접속 동안만 유지한다.
  }
  listeners.forEach(listener => listener());
}
