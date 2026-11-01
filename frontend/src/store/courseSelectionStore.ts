import { useSyncExternalStore } from "react";
import type { Course } from "../types/course";

// 코스 목록·상세·등산 담기 화면이 함께 사용할 메모리 저장소. 새로고침하면 초기화한다.
let savedCourseIds: readonly string[] = [];
const savedCourseDetails = new Map<string, Course>();
const listeners = new Set<() => void>();

export function getSavedCourseIds(): readonly string[] { return savedCourseIds; }
export function getSavedCourse(courseId: string) { return savedCourseDetails.get(courseId); }
export function subscribeSavedCourses(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setCourseSaved(courseId: string, saved: boolean, course?: Course) {
  if (course && course.id !== courseId) throw new Error("담을 코스 ID가 일치하지 않습니다.");
  const detailsChanged = saved && course !== undefined && savedCourseDetails.get(courseId) !== course;
  if (savedCourseIds.includes(courseId) === saved && !detailsChanged) return;
  if (saved && course) savedCourseDetails.set(courseId, course);
  if (!saved) savedCourseDetails.delete(courseId);
  savedCourseIds = saved ? [...new Set([...savedCourseIds, courseId])] : savedCourseIds.filter(id => id !== courseId);
  listeners.forEach(listener => listener());
}
export function useSavedCourseIds() {
  return useSyncExternalStore(subscribeSavedCourses, getSavedCourseIds);
}
