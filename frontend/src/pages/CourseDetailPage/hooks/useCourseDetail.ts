import { useCallback, useEffect, useRef, useState } from "react";
import { loadCourseDetailData } from "../../../api/courseDetailMock";
import type { CourseRequest } from "../../../types/course";
import type { CourseDetailState } from "../../../types/courseDetail";

export function useCourseDetail({ mountainId, courseId }: CourseRequest) {
  const [result, setResult] = useState<{ key: string; state: CourseDetailState } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([mountainId, courseId, attempt]);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const toastId = useRef(0);
  const notify = useCallback((message: string) => setToast({ id: ++toastId.current, message }), []);
  useEffect(() => {
    const controller = new AbortController();
    loadCourseDetailData({ mountainId, courseId }, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, state: data ? { status: "success", data } : { status: "missing" } });
    }).catch(() => { if (!controller.signal.aborted) setResult({ key, state: { status: "error" } }); });
    return () => controller.abort();
  }, [mountainId, courseId, key]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  const state: CourseDetailState = result?.key === key ? result.state : { status: "loading" };
  return { state, toast, notify, retry: () => setAttempt(value => value + 1) };
}
