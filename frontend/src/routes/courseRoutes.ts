import type { CourseRequest } from "../types/course";

export const coursePaths = {
  list: (mountainId: string) => `mountains/${encodeURIComponent(mountainId)}/courses`,
  detail: ({ mountainId, courseId }: CourseRequest) =>
    `mountains/${encodeURIComponent(mountainId)}/courses/${encodeURIComponent(courseId)}`,
  schedule: ({ mountainId, courseId }: CourseRequest) =>
    `mountains/${encodeURIComponent(mountainId)}/courses/${encodeURIComponent(courseId)}/schedule`,
};

export type CourseRoute = { mountainId: string; courseId?: string; destination: "list" | "detail" | "schedule" };
export function readCourseRoute(hash: string): CourseRoute | null {
  const match = /^#?\/?mountains\/([^/?#]+)\/courses(?:\/([^/?#]+)(\/schedule)?)?\/?$/.exec(hash);
  if (!match) return null;
  try {
    return { mountainId: decodeURIComponent(match[1]), courseId: match[2] ? decodeURIComponent(match[2]) : undefined,
      destination: match[3] ? "schedule" : match[2] ? "detail" : "list" };
  } catch { return null; }
}
