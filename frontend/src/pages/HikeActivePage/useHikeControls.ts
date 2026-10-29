import { useState } from "react";
import { descendHikeRecord, finishHikeRecord } from "../../api/hikeRecordApi";
import { navigate } from "../../hooks/useHashRoute";
import { flushHikePositions, useHikeTracking, type HikeTrackingIssue } from "../../hooks/useHikeTracking";
import { finishHikeSession, startHikeDescent, type HikeSession } from "../../store/hikeSessionStore";
import { hikePaths } from "../hikeRoutes";

const TRACKING_MESSAGES: Record<HikeTrackingIssue, string> = {
  denied: "위치 권한이 꺼져 있어 이동 경로를 기록하지 못하고 있어요.",
  unavailable: "현재 위치를 받지 못하고 있어요. 이동 경로는 위치를 받으면 이어서 기록돼요.",
};

/**
 * 등산 중·하산 중 화면 공통: GPS 수집, 하산 시작, 등산 종료.
 * 기록 번호가 있으면 등산 기록 API에 저장하고, 없으면(예시 데이터 모드) 화면 상태만 바꾼다.
 */
export function useHikeControls(session: HikeSession | null) {
  const hikeRecordId = session?.phase === "complete" ? undefined : session?.hikeRecordId;
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

  const traveledKm = session?.traveledMeters === undefined ? undefined : session.traveledMeters / 1000;
  return {
    descend, finish, busy, traveledKm,
    message: error || (trackingIssue ? TRACKING_MESSAGES[trackingIssue] : ""),
    /** 기록 API로 진행 중이면 GPS 현재 위치·이동 경로를 지도에 그린다 */
    tracking: hikeRecordId !== undefined,
  };
}
