import { useSyncExternalStore } from "react";
import { sampleSchedules } from "../api/hikeMock";
import type { HikeSchedule } from "../types/hike";

// 일정 API가 생기기 전까지 화면 사이에서 일정 변경을 공유하는 메모리 저장소.
// 새로고침하면 예시 일정으로 돌아간다.
let schedules: readonly HikeSchedule[] = sampleSchedules;
const listeners = new Set<() => void>();

function update(next: HikeSchedule[]) {
  schedules = next.sort((a, b) => a.date.localeCompare(b.date));
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useHikeSchedules() {
  return useSyncExternalStore(subscribe, () => schedules);
}

export function findSchedule(date: string) {
  return schedules.find(schedule => schedule.date === date);
}

/**
 * 일정을 저장한다. 같은 날짜에는 일정 1개만 두므로 그 날짜의 기존 일정은 대체된다.
 * previousDate가 있으면 그 날짜의 일정을 새 날짜로 옮긴 것으로 본다.
 */
export function saveSchedule(schedule: HikeSchedule, previousDate?: string) {
  update([...schedules.filter(item => item.date !== schedule.date && item.date !== previousDate), schedule]);
}

export function deleteSchedule(date: string) {
  update(schedules.filter(schedule => schedule.date !== date));
}
