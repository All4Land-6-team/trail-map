import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadCourseDiscoveryData } from "../../../api/courseRoutes";
import type { Course, CourseDiscoveryState, CourseFilters, CourseSort } from "../../../types/course";
import { DEFAULT_COURSE_FILTERS, selectCourses } from "../../../utils/courseDiscovery";

const EMPTY_COURSES: readonly Course[] = [];
export function useCourseDiscovery(mountainId: string, initialCourseId?: string) {
  const [result, setResult] = useState<{ key: string; state: CourseDiscoveryState } | null>(null);
  const [filters, setFilters] = useState<CourseFilters>({ ...DEFAULT_COURSE_FILTERS });
  const [sort, setSort] = useState<CourseSort>("difficulty");
  const [selectedId, setSelectedId] = useState<string | null>(initialCourseId ?? null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const key = JSON.stringify([mountainId, retryCount]);
  const state: CourseDiscoveryState = result?.key === key ? result.state : { status: "loading" };
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const toastSequence = useRef(0);
  const notify = useCallback((message: string) => setToast({ id: ++toastSequence.current, message }), []);
  const closeFilter = useCallback(() => setFilterOpen(false), []);

  useEffect(() => {
    const controller = new AbortController();
    loadCourseDiscoveryData(mountainId, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, state: data ? { status: "success", data } : { status: "missing" } });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, state: { status: "error" } });
    });
    return () => controller.abort();
  }, [mountainId, key]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const allCourses = state.status === "success" ? state.data.courses : EMPTY_COURSES;
  const courses = useMemo(() => selectCourses(allCourses, filters, sort), [allCourses, filters, sort]);
  const selectedCourse = courses.find(course => course.id === selectedId) ?? courses[0] ?? null;
  return {
    state, filters, setFilters, sort, setSort, courses, selectedCourse, setSelectedId,
    filterOpen, openFilter: () => { setToast(null); setFilterOpen(true); }, closeFilter, toast, notify,
    retry: () => setRetryCount(count => count + 1),
  };
}
