import { useSyncExternalStore } from "react";
import type { HikeSchedule } from "../types/hike";

export type HikeSession = {
  schedule: HikeSchedule;
  mountainId: string;
  phase: "active" | "downhill" | "complete";
  alertsOn: boolean;
  startedAt: string;
  finishedAt?: string;
};

// API 연동 전 화면 전환 동안만 유지한다. GPS 이동 거리/고도는 생성하지 않는다.
let session: HikeSession | null = null;
const listeners = new Set<() => void>();
export function getHikeSession() { return session; }
function update(next: HikeSession) {
  session = next;
  listeners.forEach(listener => listener());
}
export function startHikeSession(schedule: HikeSchedule, mountainId: string, alertsOn: boolean) {
  if (session && session.phase !== "complete") return;
  update({ schedule: { ...schedule }, mountainId, alertsOn, phase: "active", startedAt: new Date().toISOString() });
}
export function setHikeAlerts(alertsOn: boolean) { if (session && session.alertsOn !== alertsOn) update({ ...session, alertsOn }); }
export function startHikeDescent() { if (session?.phase === "active") update({ ...session, phase: "downhill" }); }
export function finishHikeSession() {
  if (session && session.phase !== "complete") update({ ...session, phase: "complete", finishedAt: new Date().toISOString() });
}
export function useHikeSession() {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, getHikeSession);
}
