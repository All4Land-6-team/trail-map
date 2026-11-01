import { useMemo, useState } from "react";
import { descendHikeRecord, finishHikeRecord } from "../../api/hikeRecordApi";
import { navigate } from "../../hooks/useHashRoute";
import { flushHikePositions, useHikeTracking, type HikeTrackingIssue } from "../../hooks/useHikeTracking";
import { directedCoursePath, finishHikeSession, startHikeDescent, type HikeSession } from "../../store/hikeSessionStore";
import type { ActiveHike } from "../../types/hike";
import { OFF_COURSE_METERS, pathLengthMeters } from "../../utils/hikeTracking";
import { hikePaths } from "../hikeRoutes";

const TRACKING_MESSAGES: Record<HikeTrackingIssue, string> = {
  denied: "위치 권한이 꺼져 있어 이동 경로를 기록하지 못하고 있어요.",
  unavailable: "현재 위치를 받지 못하고 있어요. 이동 경로는 위치를 받으면 이어서 기록돼요.",
};

/**
 * 등산 중·하산 중 화면 공통: GPS 수집, 하산 시작, 등산 종료, 코스·남은 거리.
 * 기록 번호가 있으면 등산 기록 API에 저장하고 서버의 코스 경로로 남은 거리를 계산한다.
 * 없으면(예시 데이터 모드) 화면 상태만 바꾸고 hike(예시 코스)의 값을 쓴다.
 */
export function useHikeControls(session: HikeSession | null, hike?: ActiveHike | null) {
  const hikeRecordId = session?.phase === "complete" ? undefined : session?.hikeRecordId;
  const coursePath = hikeRecordId === undefined ? undefined : session?.coursePath;
  const phase = session?.phase ?? "active";
  // 위치가 바뀔 때마다 지도를 다시 만들지 않도록 같은 코스·방향이면 같은 배열을 넘긴다.
  const route = useMemo(() => coursePath ? directedCoursePath(coursePath, phase) : hike?.route, [coursePath, phase, hike?.route]);
  const trackingIssue = useHikeTracking(hikeRecordId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, failure: string) => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const descend = (alertsOn: boolean) => run(async () => {
    if (hikeRecordId !== undefined) await descendHikeRecord(hikeRecordId);
    startHikeDescent();
    navigate(hikePaths.downhill(alertsOn));
  }, "하산 시작을 저장하지 못했어요. 다시 시도해 주세요.");

  // 종료 전에 모아 둔 위치를 먼저 보내야 이동 거리에 반영된다. 보내지 못해도 종료는 진행한다.
  const finish = () => run(async () => {
    if (hikeRecordId === undefined) finishHikeSession();
    else {
      await flushHikePositions(hikeRecordId).catch(() => undefined);
      finishHikeSession(await finishHikeRecord(hikeRecordId));
    }
    navigate(hikePaths.complete);
  }, "등산 완료 기록을 저장하지 못했어요. 다시 시도해 주세요.");

  // 기록 API 모드에서는 받은 위치로 바로 계산해 보여 준다(서버 응답은 묶어서 보내는 간격만큼 늦다).
  // 서버와 같은 기준으로 거른 경로라 저장되는 이동 거리와 거의 같다. 완료 화면은 서버 값을 쓴다.
  const traveledPath = session?.traveledPath;
  const localMeters = useMemo(() => traveledPath ? pathLengthMeters(traveledPath) : 0, [traveledPath]);
  // 하산 중에는 올라온 경로를 지우고 하산을 시작한 지점부터 새로 그린다.
  const descentPathStart = session?.phase === "downhill" ? session.descentPathStart : undefined;
  const mapPath = useMemo(() => traveledPath && descentPathStart !== undefined ? traveledPath.slice(descentPathStart) : traveledPath,
    [traveledPath, descentPathStart]);
  const traveledKm = hikeRecordId !== undefined ? localMeters / 1000
    : session?.traveledMeters === undefined ? undefined : session.traveledMeters / 1000;
  const progress = coursePath ? session?.courseProgress : undefined;
  // 위치를 받기 전에는 코스 전체 길이가 남은 거리다.
  const courseKm = session?.courseDistanceMeters === undefined ? undefined : session.courseDistanceMeters / 1000;
  const remainingKm = progress ? progress.remainingMeters / 1000 : (coursePath && courseKm) ?? hike?.remainingKm ?? 0;
  // 원하는 길로 갈 수도 있어 위치를 코스로 옮기거나 막지 않고, 떨어진 거리만 작게 알려 준다.
  const courseNotice = progress && progress.offCourseMeters > OFF_COURSE_METERS
    ? `코스에서 ${Math.round(progress.offCourseMeters)}m 떨어져 있어요` : undefined;
  return {
    descend, finish, busy, traveledKm,
    route: route ?? [],
    peak: coursePath?.at(-1) ?? hike?.peak,
    remainingKm,
    /** 코스상 진행률(%). 예시 데이터 모드에서는 없다. */
    progressPercent: coursePath ? Math.round((progress ? progress.alongMeters / progress.totalMeters : 0) * 100) : undefined,
    courseNotice,
    /** 지도에 그릴 실제 이동 경로 (하산 중에는 하산 구간만) */
    mapPath: mapPath ?? [],
    message: error || (trackingIssue ? TRACKING_MESSAGES[trackingIssue] : ""),
    /** 기록 API로 진행 중이면 GPS 현재 위치·이동 경로를 지도에 그린다 */
    tracking: hikeRecordId !== undefined,
  };
}
