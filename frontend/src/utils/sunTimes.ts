import * as SunCalc from "suncalc";
import type { LngLat } from "../types/hike";

export type SunPhase = "before-sunrise" | "daylight" | "sunset-soon" | "after-sunset";

export type SunArcState = {
  progress: number;
  phase: SunPhase;
  message: string;
  remainingMinutes: number | null;
};

export type SunTimes = {
  sunrise: Date;
  sunset: Date;
};

function validDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function validCoordinate(coordinate: LngLat | undefined): coordinate is LngLat {
  return coordinate !== undefined
    && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1])
    && coordinate[0] >= -180 && coordinate[0] <= 180
    && coordinate[1] >= -90 && coordinate[1] <= 90;
}

/** 좌표와 날짜에 해당하는 천문학적 일출·일몰. 좌표가 없거나 계산 결과가 유효하지 않으면 값을 만들지 않는다. */
export function sunTimesForCoordinate(date: Date, coordinate: LngLat | undefined): SunTimes | null {
  if (!validDate(date) || !validCoordinate(coordinate)) return null;
  const [longitude, latitude] = coordinate;
  const result = SunCalc.getTimes(date, latitude, longitude);
  if (!validDate(result.sunrise) || !validDate(result.sunset) || result.sunset <= result.sunrise) return null;
  return { sunrise: result.sunrise, sunset: result.sunset };
}

function remainingMessage(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `일몰까지 ${rest}분`;
  if (rest === 0) return `일몰까지 ${hours}시간`;
  return `일몰까지 ${hours}시간 ${rest}분`;
}

/** 현재 시각을 일출~일몰 사이 0..1 진행률과 사용자 안내 상태로 바꾼다. */
export function calculateSunArcState(now: Date, sunrise: Date, sunset: Date): SunArcState {
  if (now < sunrise) return { progress: 0, phase: "before-sunrise", message: "일출 전이에요", remainingMinutes: null };
  if (now >= sunset) return { progress: 1, phase: "after-sunset", message: "일몰이 지났어요", remainingMinutes: 0 };

  const duration = sunset.getTime() - sunrise.getTime();
  const progress = Math.min(1, Math.max(0, (now.getTime() - sunrise.getTime()) / duration));
  const remainingMinutes = Math.max(1, Math.ceil((sunset.getTime() - now.getTime()) / 60_000));
  return {
    progress,
    phase: remainingMinutes <= 60 ? "sunset-soon" : "daylight",
    message: remainingMessage(remainingMinutes),
    remainingMinutes,
  };
}

const clockFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatSunClock(value: Date) {
  return clockFormatter.format(value);
}
