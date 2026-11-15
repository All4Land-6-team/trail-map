import { useEffect, useMemo, useState } from "react";
import type { LngLat } from "../types/hike";
import { calculateSunArcState, formatSunClock, sunTimesForCoordinate, type SunPhase } from "../utils/sunTimes";

export type SunTimesView = {
  available: boolean;
  progress: number;
  phase: SunPhase | "unavailable";
  message: string;
  sunriseLabel?: string;
  sunsetLabel?: string;
  currentLabel: string;
};

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** 실제 시각은 1분마다 갱신하고, 날짜나 기준 좌표가 바뀔 때만 일출·일몰을 다시 계산한다. */
export function useSunTimes(coordinate?: LngLat): SunTimesView {
  const [now, setNow] = useState(() => new Date());
  const longitude = coordinate?.[0];
  const latitude = coordinate?.[1];
  const dateKey = localDateKey(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const times = useMemo(
    () => sunTimesForCoordinate(now, longitude === undefined || latitude === undefined ? undefined : [longitude, latitude]),
    // dateKey intentionally makes the calculation refresh after local midnight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateKey, longitude, latitude],
  );

  return useMemo(() => {
    if (!times) return {
      available: false,
      progress: 0,
      phase: "unavailable" as const,
      message: "위치 정보가 없어 일출·일몰을 계산할 수 없어요",
      currentLabel: formatSunClock(now),
    };
    const state = calculateSunArcState(now, times.sunrise, times.sunset);
    return {
      available: true,
      ...state,
      sunriseLabel: formatSunClock(times.sunrise),
      sunsetLabel: formatSunClock(times.sunset),
      currentLabel: formatSunClock(now),
    };
  }, [now, times]);
}
