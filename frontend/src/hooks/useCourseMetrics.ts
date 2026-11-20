import { useEffect, useState } from "react";
import { courseAnalysisUrl, parseCourseAnalysis } from "../api/courseAnalysis";
import { authHeaders } from "../store/authStore";
import type { AnalysisMetrics } from "../types/courseAnalysis";

/**
 * 서버 코스의 DEM 분석 요약(최대 고도·급경사 비율 등). 일정 상세처럼 요약만 필요한 화면용이라
 * 고도 단면(profile)은 받지 않는다. 예시 코스이거나 불러오지 못하면 undefined.
 */
export function useCourseMetrics(serverCourseId: number | undefined) {
  const [loaded, setLoaded] = useState<{ courseId: number; metrics?: AnalysisMetrics }>();
  useEffect(() => {
    if (serverCourseId === undefined) return;
    const controller = new AbortController();
    fetch(courseAnalysisUrl(serverCourseId), { signal: controller.signal, headers: authHeaders({ Accept: "application/json" }) })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then((body: { success?: boolean; data?: unknown }) => {
        if (!controller.signal.aborted) setLoaded({ courseId: serverCourseId, metrics: parseCourseAnalysis(body?.data).metrics });
      })
      .catch(() => { if (!controller.signal.aborted) setLoaded({ courseId: serverCourseId }); });
    return () => controller.abort();
  }, [serverCourseId]);
  return loaded && loaded.courseId === serverCourseId ? loaded.metrics : undefined;
}
