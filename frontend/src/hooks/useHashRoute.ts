import { useEffect, useState } from "react";

function readHash() {
  return window.location.hash.replace(/^#\/?/, "");
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
