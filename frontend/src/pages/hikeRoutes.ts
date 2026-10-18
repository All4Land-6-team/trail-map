import type { BottomDestination } from "../components/layout";
import { navigate } from "../hooks/useHashRoute";
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
