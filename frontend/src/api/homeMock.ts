import { HOME_TIME_ZONE } from "../constants/home";
import type { HomeDiscoveryData } from "../types/home";
import { toHomeDateKey } from "../utils/homeDiscovery";

// 화면 확인용 대표 좌표·일정이다. 실제 시설·등산로·안전 분석값은 포함하지 않는다.
const mountains: HomeDiscoveryData["mountains"] = [
  { id: "bukhansan", name: "북한산", position: [126.977, 37.659] },
  { id: "dobongsan", name: "도봉산", position: [127.034, 37.696] },
  { id: "seoraksan", name: "설악산", position: [128.465, 38.119] },
  { id: "gwanaksan", name: "관악산", position: [126.964, 37.445] },
  { id: "jirisan", name: "지리산", position: [127.731, 35.337] },
];

/** API 도입 시 이 함수와 동일한 화면용 데이터를 반환하도록 교체한다. */
export async function loadHomeDiscoveryData(signal: AbortSignal): Promise<HomeDiscoveryData> {
  signal.throwIfAborted();
  await Promise.resolve();
  signal.throwIfAborted();
  return {
    mountains,
    recommendedMountainIds: ["bukhansan", "dobongsan"],
    initialRecentMountainIds: ["bukhansan", "dobongsan"],
    schedules: [{
      date: toHomeDateKey(new Date(), HOME_TIME_ZONE),
      startTime: "07:30",
      courseId: "bukhansan-baegundae",
      mountainName: "북한산",
      courseName: "백운대 코스",
      phase: "planned",
    }],
  };
}
