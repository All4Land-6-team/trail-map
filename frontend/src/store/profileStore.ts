import { useSyncExternalStore } from "react";

export const DEFAULT_NICKNAME = "익명";
export const NICKNAME_MAX_LENGTH = 12;

let nickname = DEFAULT_NICKNAME;
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

export function normalizeNickname(value: string) {
  return value.trim().slice(0, NICKNAME_MAX_LENGTH) || DEFAULT_NICKNAME;
}

/** API에서 조회하거나 저장한 닉네임을 화면 사이에 공유한다. */
export function setNickname(value: string) {
  nickname = normalizeNickname(value);
  listeners.forEach(listener => listener());
}
