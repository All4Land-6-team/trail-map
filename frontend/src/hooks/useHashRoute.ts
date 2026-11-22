import { useEffect, useState } from "react";

function readHash() {
  return window.location.hash.replace(/^#\/?/, "");
}

// 상세 화면도 담기에서 열었으면 같은 방문으로 취급한다. 내부 왕복으로 진입 화면을 덮어쓰지 않는다.
function isCartContext(route: string, depth = 0): boolean {
  if (/^cart(?:\/|\?|$)/.test(route)) return true;
  const returnTo = new URLSearchParams(route.split("?")[1] ?? "").get("returnTo");
  return depth < 2 && !!returnTo && isCartContext(returnTo, depth + 1);
}

let cartEntry = "";
// App에서 항상 읽는 라우팅 모듈에서 기록한다. 지연 로딩되는 CartPage에서는 최초 진입을 놓칠 수 있다.
if (typeof window !== "undefined") {
  window.addEventListener("hashchange", (event) => {
    const from = new URL(event.oldURL).hash.replace(/^#\/?/, "");
    const to = new URL(event.newURL).hash.replace(/^#\/?/, "");
    if (isCartContext(to) && !isCartContext(from)) cartEntry = from;
  });
}

/** 직접 진입·새로고침은 홈, 앱 안에서 진입했으면 담기에 들어오기 전 화면으로 복귀한다. */
export function leaveCart() {
  navigate(cartEntry);
}

/** `#hikes/calendar?date=2026-10-03` 같은 해시 주소를 읽는다. 라우터 도입 전까지 화면 전환에 쓴다. */
export function useHashRoute() {
  const [route, setRoute] = useState(readHash);

  useEffect(() => {
    const update = () => setRoute(readHash());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  return route;
}

/** 해시 주소에서 `?` 앞의 화면 경로 */
export function routePath(route: string) {
  return route.split("?")[0];
}

/** 현재 해시 주소의 `?` 뒤 값 */
export function readHashParams() {
  return new URLSearchParams(readHash().split("?")[1] ?? "");
}

export function navigate(route: string) {
  window.location.hash = route;
}
