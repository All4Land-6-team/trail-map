import { useCallback, useEffect, useRef, useState } from "react";
import { loadCourseDetailData } from "../../../api/courseDetailMock";
import type { CourseRequest } from "../../../types/course";
import type { CourseDetailState } from "../../../types/courseDetail";

export function useCourseDetail({ mountainId, courseId }: CourseRequest) {
  const [state, setState] = useState<CourseDetailState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const toastId = useRef(0);
  const notify = useCallback((message: string) => setToast({ id: ++toastId.current, message }), []);
  useEffect(() => {
    const controller = new AbortController();
    loadCourseDetailData({ mountainId, courseId }, controller.signal).then(data => {
      if (!controller.signal.aborted) setState(data ? { status: "success", data } : { status: "missing" });
    }).catch(() => { if (!controller.signal.aborted) setState({ status: "error" }); });
    return () => controller.abort();
  }, [mountainId, courseId, attempt]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  return { state, toast, notify, retry: () => { setState({ status: "loading" }); setAttempt(value => value + 1); } };
}
