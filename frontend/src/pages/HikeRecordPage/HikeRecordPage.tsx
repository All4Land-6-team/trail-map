import { useEffect, useState } from "react";
import { courseFixtures } from "../../api/courseMock";
import { fetchHikeRecord, type HikeRecord } from "../../api/hikeRecordApi";
import { findCourse } from "../../api/hikeMock";
import { Button } from "../../components/common/Button";
import { Icon } from "../../components/common/Icon";
import { HikeRouteMap } from "../../components/hike";
import { COURSE_ROUTE_COLOR, GRAY_ROUTE_COLOR } from "../../components/hike/hikeRouteSegments";
import { BottomNavigation, TopBar } from "../../components/layout";
import { navigate, readHashParams } from "../../hooks/useHashRoute";
import { useScheduleCourse } from "../../hooks/useScheduleCourse";
import { useHikeSchedules } from "../../store/hikeScheduleStore";
import { useScheduleRecord } from "../../store/scheduleRecord";
import type { LngLat } from "../../types/hike";
import { formatDuration, formatKoreanTime, parseDateKey } from "../../utils/hikeFormat";
import { hikePaths, navigateTab } from "../hikeRoutes";
import "../hikePages.css";
import "./HikeRecordPage.css";

const MAP_PADDING = { top: 28, bottom: 28, left: 28, right: 28 };
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 10월 11일 (일) */
function formatShortDate(date: string) {
  const day = parseDateKey(date);
  return `${day.getMonth() + 1}월 ${day.getDate()}일 (${WEEKDAYS[day.getDay()]})`;
}

/** ISO 시각 → 07:30 (현지 시각) */
function clockOf(iso: string | undefined) {
  if (!iso) return undefined;
  const time = new Date(iso);
  return Number.isNaN(time.getTime()) ? undefined
    : `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
}

/** 예시 데이터용 이동 경로: 코스 좌표를 번갈아 20m 안팎으로 비켜 간다. */
function sampleWalk(path: LngLat[]): LngLat[] {
  return path.map(([lng, lat], index) => index === 0 || index === path.length - 1 ? [lng, lat]
    : [lng, lat + (index % 2 ? 0.00018 : -0.00012)]);
}

/** REC-03 등산 기록 상세 (`#hikes/record?date=YYYY-MM-DD`). 진입: REC-01 완료한 등산 카드 · 등산 기록 보기 */
export function HikeRecordPage() {
  const [date] = useState(() => readHashParams().get("date") ?? "");
  const schedule = useHikeSchedules().find(item => item.date === date);
  const record = useScheduleRecord(schedule);
  const scheduleCourse = useScheduleCourse(schedule);
  // 서버 기록이 있으면 기록 시작 때 저장한 코스 경로와 실제 이동 경로를 불러온다.
  const [detail, setDetail] = useState<{ id: number; record?: HikeRecord; failed?: boolean }>();
  const hikeRecordId = record?.status === "COMPLETED" ? record.hikeRecordId : undefined;
  useEffect(() => {
    if (hikeRecordId === undefined) return;
    let cancelled = false;
    fetchHikeRecord(hikeRecordId)
      .then(loaded => { if (!cancelled) setDetail({ id: hikeRecordId, record: loaded }); })
      .catch(() => { if (!cancelled) setDetail({ id: hikeRecordId, failed: true }); });
    return () => { cancelled = true; };
  }, [hikeRecordId]);
  const loaded = detail?.id === hikeRecordId ? detail : undefined;
  const backToCalendar = () => navigate(hikePaths.calendar(date || undefined));

  if (!schedule || record?.status !== "COMPLETED") return <div className="hike-page hike-record-page">
    <TopBar title="등산 기록" showAction={false} onBack={backToCalendar} />
    <main className="hike-page__body hike-record-page__body">
      <p className="hike-record-page__empty">{schedule ? "아직 마치지 않은 등산이에요." : "등산 기록을 찾을 수 없어요."}</p>
    </main>
    <BottomNavigation className="hike-page__nav" active="myHikes" onNavigate={navigateTab} />
  </div>;

  const sample = findCourse(schedule.courseId);
  const coursePath: LngLat[] = loaded?.record?.coursePath.length ? loaded.record.coursePath
    : scheduleCourse?.route.length ? scheduleCourse.route : sample?.route ?? [];
  // 예시 데이터는 이동 경로가 없어 코스 옆을 조금씩 벗어나며 걸은 예시 경로를 그린다.
  const traveledPath: LngLat[] = loaded?.record ? loaded.record.traveledPath : hikeRecordId === undefined ? sampleWalk(coursePath) : [];
  const traveledKm = loaded?.record?.traveledDistanceMeters != null ? loaded.record.traveledDistanceMeters / 1000 : record.traveledKm;
  const durationMinutes = loaded?.record?.actualDurationSeconds != null
    ? Math.round(loaded.record.actualDurationSeconds / 60) : record.durationMinutes;
  const startClock = clockOf(loaded?.record?.startedAt ?? record.startedAt) ?? schedule.startTime;
  const endClock = clockOf(loaded?.record?.endedAt ?? record.endedAt ?? undefined);
  const title = `${schedule.mountainName} · ${schedule.courseName}`;
  const mountainId = schedule.serverMountainId !== undefined ? String(schedule.serverMountainId)
    : courseFixtures.find(item => item.id === schedule.courseId)?.mountainId;

  const writeReview = () => {
    const query = new URLSearchParams({ from: "hikes/complete", returnTo: hikePaths.record(date) });
    if (mountainId) query.set("mountain", mountainId);
    navigate(`community?${query}`);
  };

  return <div className="hike-page hike-record-page">
    <TopBar title="등산 기록" showAction={false} onBack={backToCalendar} />
    <main className="hike-page__body hike-record-page__body">
      <section className="hike-record-page__summary" aria-labelledby="hike-record-title">
        <Icon name="Mountain" size={22} color="currentColor" />
        <h2 id="hike-record-title">{title}</h2>
        <p>{formatShortDate(schedule.date)} · {formatKoreanTime(startClock)}{endClock ? ` ~ ${formatKoreanTime(endClock)}` : ""}</p>
      </section>

      <section className="hike-record-page__map" aria-label="코스와 실제로 걸은 경로">
        {hikeRecordId !== undefined && !loaded
          ? <p className="hike-record-page__map-status" role="status">경로를 불러오는 중이에요.</p>
          : coursePath.length > 1
            // 요약용 2D 지도라 3D 지형(mountainName)은 불러오지 않는다.
            ? <HikeRouteMap route={coursePath} traveledPath={traveledPath} alwaysShowTraveledPath dimension="2D" padding={MAP_PADDING} label={`${title} 등산 기록 지도`} />
            : <p className="hike-record-page__map-status" role="status">경로를 불러오지 못했어요.</p>}
      </section>
      <ul className="hike-record-page__legend">
        <li><span style={{ background: COURSE_ROUTE_COLOR }} aria-hidden="true" />코스</li>
        <li><span style={{ background: GRAY_ROUTE_COLOR }} aria-hidden="true" />실제로 걸은 경로</li>
      </ul>
      {loaded?.failed && <p className="hike-record-page__notice" role="status">저장된 이동 경로를 불러오지 못해 코스만 표시했어요.</p>}

      <dl className="hike-record-page__stats">
        <div><dt>이동 거리</dt><dd>{traveledKm === undefined ? "—" : `${traveledKm.toFixed(1)} km`}</dd></div>
        <div><dt>소요 시간</dt><dd>{durationMinutes === undefined ? "—" : formatDuration(durationMinutes)}</dd></div>
      </dl>

      <div className="hike-record-page__actions">
        <Button fullWidth label="후기 작성" onClick={writeReview} />
        <Button fullWidth variant="secondary" label="내 등산으로" onClick={backToCalendar} />
      </div>
    </main>
    <BottomNavigation className="hike-page__nav" active="myHikes" onNavigate={navigateTab} />
  </div>;
}
