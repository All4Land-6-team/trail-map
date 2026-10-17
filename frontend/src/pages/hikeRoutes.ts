import type { BottomDestination } from "../components/layout";
import { navigate } from "../hooks/useHashRoute";

/** 내 등산 화면 주소 (Figma 화면 설계의 #hikes/... 주소) */
export const hikePaths = {
  calendar: (date?: string) => date ? `hikes/calendar?date=${date}` : "hikes/calendar",
  detail: (date: string) => `hikes/detail?date=${date}`,
  today: "hikes/today",
  active: (alerts: boolean) => `hikes/active?alerts=${alerts ? "on" : "off"}`,
  downhill: (alerts: boolean) => `hikes/downhill?alerts=${alerts ? "on" : "off"}`,
  complete: "hikes/complete",
};

/** 하단 탭 이동. 홈·커뮤니티·등산 담기 화면이 생기기 전까지는 기본 지도로 간다. */
export function navigateTab(destination: BottomDestination) {
  navigate(destination === "myHikes" ? hikePaths.calendar() : "");
}
