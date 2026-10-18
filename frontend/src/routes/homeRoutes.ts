import type { TodayHikeSchedule } from "../types/home";

export const homePaths = {
  home: "",
  community: "community",
  saved: "cart",
  myHikes: "myHikes",
  mountainCourses: (mountainId: string) => `mountains/${encodeURIComponent(mountainId)}/courses`,
  todayHike: (phase: TodayHikeSchedule["phase"]) => phase === "active" ? "hikes/active" : "hikes/today",
} as const;

export function navigateFromHome(path: string) {
  window.location.hash = path;
}
