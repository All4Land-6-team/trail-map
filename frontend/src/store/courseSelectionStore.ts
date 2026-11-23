import { useSyncExternalStore } from "react";
import type { Course } from "../types/course";
import { databaseCourseId } from "../utils/courseIdentity.ts";
import { getAuthSession } from "./authStore.ts";

// 코스 목록·상세·등산 담기 화면이 함께 사용하는 담은 코스 저장소.
// 실제(DB) 코스(`db-{번호}`)는 로그인한 계정에 저장한다(/api/v1/saved-courses). 앱을 열거나 로그인하면 서버 목록으로 채우고,
// 담기·빼기는 화면에 먼저 반영한 뒤 서버에 보낸다. 서버가 거절하면 되돌린다.
// 예시 코스(서버 번호 없음)는 이 화면에서만 유지하고 새로고침하면 사라진다.

let savedCourseIds: readonly string[] = [];
const savedCourseDetails = new Map<string, Course>();
const listeners = new Set<() => void>();
/** 서버 목록을 다시 받을 때 늦게 도착한 이전 응답을 버리기 위한 번호 */
let syncGeneration = 0;

function emit() {
  listeners.forEach(listener => listener());
}

export function getSavedCourseIds(): readonly string[] { return savedCourseIds; }
export function getSavedCourse(courseId: string) { return savedCourseDetails.get(courseId); }
export function subscribeSavedCourses(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** 화면 상태만 바꾼다. 바뀌었으면 true */
function applySaved(courseId: string, saved: boolean, course?: Course) {
  if (course && course.id !== courseId) throw new Error("담을 코스 ID가 일치하지 않습니다.");
  const detailsChanged = saved && course !== undefined && savedCourseDetails.get(courseId) !== course;
  if (savedCourseIds.includes(courseId) === saved && !detailsChanged) return false;
  if (saved && course) savedCourseDetails.set(courseId, course);
  if (!saved) savedCourseDetails.delete(courseId);
  savedCourseIds = saved ? [...new Set([...savedCourseIds, courseId])] : savedCourseIds.filter(id => id !== courseId);
  emit();
  return true;
}

/**
 * 담기·빼기. 로그인했으면 실제 코스는 서버에도 저장하고, 서버가 거절하면 화면을 되돌린 뒤 오류를 던진다.
 * 화면은 기다리지 않고 바로 바뀐다.
 */
export function setCourseSaved(courseId: string, saved: boolean, course?: Course): Promise<void> {
  const wasSaved = savedCourseIds.includes(courseId);
  const previous = savedCourseDetails.get(courseId);
  applySaved(courseId, saved, course);                 // ID가 맞지 않으면 여기서 바로 오류(화면은 그대로)
  const serverId = databaseCourseId(courseId);
  // 로그인하지 않았으면(예시 화면·테스트) 이 화면에서만 유지한다.
  if (serverId === null || wasSaved === saved || !getAuthSession()) return Promise.resolve();
  return persistSaved(courseId, serverId, saved, wasSaved, previous);
}

async function persistSaved(courseId: string, serverId: number, saved: boolean, wasSaved: boolean, previous?: Course) {
  const { deleteSavedCourse, putSavedCourse } = await import("../api/savedCourseApi.ts");
  try {
    if (saved) await putSavedCourse(serverId);
    else await deleteSavedCourse(serverId);
  } catch (error) {
    applySaved(courseId, wasSaved, previous);
    throw error;
  }
}

/**
 * 로그인한 계정의 담은 코스를 서버에서 받아 채운다(앱 시작·로그인 시).
 * 코스 경로·정보는 코스 경로 API로 불러온다. 예시 코스 담기는 그대로 둔다.
 */
export async function syncSavedCoursesFromServer(): Promise<void> {
  const generation = ++syncGeneration;
  const [{ fetchSavedCourses }, { loadCourseDetailData }] = await Promise.all([
    import("../api/savedCourseApi.ts"), import("../api/courseRoutes.ts"),
  ]);
  const items = await fetchSavedCourses();
  const controller = new AbortController();
  const loaded = await Promise.all(items.map(async item => {
    const id = `db-${item.courseId}`;
    const cached = savedCourseDetails.get(id);
    if (cached || !item.mountainKey) return { id, course: cached };
    const detail = await loadCourseDetailData({ mountainId: item.mountainKey, courseId: id }, controller.signal).catch(() => null);
    return { id, course: detail?.course };
  }));
  if (generation !== syncGeneration) return;
  const local = savedCourseIds.filter(id => databaseCourseId(id) === null);
  savedCourseDetails.forEach((_, id) => { if (databaseCourseId(id) !== null) savedCourseDetails.delete(id); });
  loaded.forEach(({ id, course }) => { if (course) savedCourseDetails.set(id, course); });
  // 코스 정보를 불러오지 못한 코스도 담긴 상태로 둔다(다음 동기화나 코스 화면 방문 때 채워짐).
  savedCourseIds = [...loaded.map(item => item.id), ...local];
  emit();
}

/** 로그아웃: 계정에 저장된 담기를 화면에서 비운다. */
export function clearSavedCourses() {
  syncGeneration++;
  if (!savedCourseIds.length && !savedCourseDetails.size) return;
  savedCourseIds = [];
  savedCourseDetails.clear();
  emit();
}

export function useSavedCourseIds() {
  return useSyncExternalStore(subscribeSavedCourses, getSavedCourseIds);
}
