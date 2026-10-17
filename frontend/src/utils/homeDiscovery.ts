import type { HomeMountain, TodayHikeSchedule } from "../types/home";

export function normalizeMountainQuery(query: string) {
  return query.normalize("NFC").replace(/\s+/gu, "").toLocaleLowerCase("ko");
}

/** 정확히 일치하는 이름을 우선하고, 그다음 이름에 검색어를 포함하는 산을 찾는다. */
export function findMountainByQuery(mountains: readonly HomeMountain[], query: string) {
  const normalized = normalizeMountainQuery(query);
  if (!normalized) return undefined;
  return mountains.find((mountain) => normalizeMountainQuery(mountain.name) === normalized)
    ?? mountains.find((mountain) => normalizeMountainQuery(mountain.name).includes(normalized));
}

export function readRecentMountainIds(
  raw: string | null,
  allowedIds: ReadonlySet<string>,
  fallback: readonly string[],
  limit: number,
): string[] {
  if (raw === null) return [...fallback].filter((id) => allowedIds.has(id)).slice(0, limit);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...fallback].filter((id) => allowedIds.has(id)).slice(0, limit);
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && allowedIds.has(id)))].slice(0, limit);
  } catch {
    return [...fallback].filter((id) => allowedIds.has(id)).slice(0, limit);
  }
}

export function addRecentMountain(ids: readonly string[], mountainId: string, limit: number) {
  return [mountainId, ...ids.filter((id) => id !== mountainId)].slice(0, limit);
}

export function toHomeDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function findTodaySchedule(schedules: readonly TodayHikeSchedule[], today: string) {
  return schedules.find((schedule) => schedule.date === today && schedule.phase === "active")
    ?? schedules.find((schedule) => schedule.date === today);
}
