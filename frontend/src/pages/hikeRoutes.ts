import type { BottomDestination } from "../components/layout";
import { navigate, routePath } from "../hooks/useHashRoute";
import { homePaths } from "../routes/homeRoutes";

/** 내 등산 화면 주소 (Figma 화면 설계의 #hikes/... 주소) */
export const hikePaths = {
  calendar: (date?: string) => date ? `hikes/calendar?date=${date}` : "hikes/calendar",
  detail: (date: string) => `hikes/detail?date=${date}`,
  today: "hikes/today",
  active: (alerts: boolean) => `hikes/active?alerts=${alerts ? "on" : "off"}`,
  downhill: (alerts: boolean) => `hikes/downhill?alerts=${alerts ? "on" : "off"}`,
  complete: "hikes/complete",
};

/** 모든 화면에서 같은 하단 탭 목적지를 사용한다. */
export function navigateTab(destination: BottomDestination) {
  navigate(homePaths[destination]);
}

/** 내 등산 영역(캘린더 · 일정 상세 · 등산 진행) 주소인지 */
function isHikeRoute(route: string) {
  const path = routePath(route);
  return path === "myHikes" || path.startsWith("hikes/");
}

function routeOfUrl(url: string) {
  return new URL(url).hash.replace(/^#\/?/, "");
}

// 캘린더에 들어오기 직전의 내 등산 밖 화면. 주소로 바로 들어왔으면 홈("")으로 돌아간다.
let myHikesEntry = "";

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", (event) => {
    const from = routeOfUrl(event.oldURL);
    const to = routePath(routeOfUrl(event.newURL));
    if ((to === "myHikes" || to === "hikes/calendar") && !isHikeRoute(from)) myHikesEntry = from;
  });
}

/** HIKE-01 뒤로 가기: 내 등산에 들어오기 전 화면으로 돌아간다. */
export function leaveMyHikes() {
  navigate(myHikesEntry);
}
