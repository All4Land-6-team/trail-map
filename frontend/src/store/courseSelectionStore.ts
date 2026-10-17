import { useSyncExternalStore } from "react";

// 코스 목록·상세·등산 담기 화면이 함께 사용할 메모리 저장소. 새로고침하면 초기화한다.
let savedCourseIds: readonly string[] = [];
const listeners = new Set<() => void>();

export function getSavedCourseIds(): readonly string[] { return savedCourseIds; }
export function subscribeSavedCourses(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setCourseSaved(courseId: string, saved: boolean) {
  if (savedCourseIds.includes(courseId) === saved) return;
  savedCourseIds = saved ? [...savedCourseIds, courseId] : savedCourseIds.filter(id => id !== courseId);
  listeners.forEach(listener => listener());
}
export function useSavedCourseIds() {
  return useSyncExternalStore(subscribeSavedCourses, getSavedCourseIds);
}
