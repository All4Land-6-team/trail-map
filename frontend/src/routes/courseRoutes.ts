import type { CourseRequest } from "../types/course";

export const coursePaths = {
  list: (mountainId: string, selectedCourseId?: string) => `mountains/${encodeURIComponent(mountainId)}/courses${selectedCourseId ? `?selected=${encodeURIComponent(selectedCourseId)}` : ""}`,
  detail: ({ mountainId, courseId }: CourseRequest) =>
    `mountains/${encodeURIComponent(mountainId)}/courses/${encodeURIComponent(courseId)}`,
  schedule: ({ mountainId, courseId }: CourseRequest) =>
    `mountains/${encodeURIComponent(mountainId)}/courses/${encodeURIComponent(courseId)}/schedule`,
};

export type CourseRoute = { mountainId: string; courseId?: string; selectedCourseId?: string; destination: "list" | "detail" | "schedule" };
export function readCourseRoute(hash: string): CourseRoute | null {
  const match = /^#?\/?mountains\/([^/?#]+)\/courses(?:\/([^/?#]+)(\/schedule)?)?\/?$/.exec(hash.split("?")[0]);
  if (!match) return null;
  try {
    const selectedCourseId = !match[2] ? new URLSearchParams(hash.split("?")[1] ?? "").get("selected") : null;
    return { mountainId: decodeURIComponent(match[1]), courseId: match[2] ? decodeURIComponent(match[2]) : undefined,
      ...(selectedCourseId ? { selectedCourseId } : {}),
      destination: match[3] ? "schedule" : match[2] ? "detail" : "list" };
  } catch { return null; }
}
