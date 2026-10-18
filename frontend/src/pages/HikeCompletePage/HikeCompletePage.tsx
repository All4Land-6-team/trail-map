import { findCourse } from "../../api/hikeMock";
import { useHikeSession } from "../../store/hikeSessionStore";
import { Button } from "../../components/common/Button";
import { Icon } from "../../components/common/Icon";
import { BottomNavigation } from "../../components/layout";
import { navigate } from "../../hooks/useHashRoute";
import { formatDuration } from "../../utils/hikeFormat";
import { hikePaths, navigateTab } from "../hikeRoutes";
import "../hikePages.css";
import "./HikeCompletePage.css";

/** HIKE-08 등산 완료 (`#hikes/complete`) */
export function HikeCompletePage({ onWriteReview }: { onWriteReview: (mountainId: string, finishedAt: string) => void }) {
  const session = useHikeSession();
  // 나중에 → 오늘 날짜가 선택된 HIKE-01 캘린더
  const backToCalendar = () => navigate(hikePaths.calendar());
  if (!session?.finishedAt) return <main className="hike-page__empty-state"><p>완료된 등산 기록이 없어요.</p>
    <Button label="내 등산 캘린더로" onClick={backToCalendar} /></main>;
  const finishedAt = session.finishedAt;
  const result = { ...session.schedule, mountainId: session.mountainId,
    durationMinutes: Math.max(0, Math.floor((Date.parse(finishedAt) - Date.parse(session.startedAt)) / 60_000)),
    sunset: findCourse(session.schedule.courseId)?.sunset ?? "정보 없음" };

  return <div className="hike-page hike-complete-page">
    <main className="hike-page__body hike-complete-page__body">
      <header className="hike-complete-page__header">
        <button type="button" className="hike-complete-page__back" aria-label="뒤로 가기" onClick={backToCalendar}>
          <Icon name="Back" size={22} color="currentColor" />
        </button>
        <h1 className="hike-complete-page__header-title">등산 완료</h1>
      </header>

      <section className="hike-complete-page__summary" aria-labelledby="hike-complete-title">
        <span className="hike-complete-page__check" aria-hidden="true"><Icon name="Check" size={50} /></span>
        <h2 id="hike-complete-title" className="hike-complete-page__title">등산을 마쳤어요</h2>
        <p className="hike-complete-page__course">{result.mountainName} · {result.courseName}</p>
      </section>

      <dl className="hike-complete-page__stats">
        <div><dt>이동 거리</dt><dd>기록 없음</dd></div>
        <div><dt>소요 시간</dt><dd>{formatDuration(result.durationMinutes)}</dd></div>
      </dl>

      <div className="hike-complete-page__sunset">
        <p className="hike-complete-page__sunset-time">일몰 {result.sunset}</p>
        <p className="hike-complete-page__sunset-note">
          GPS 이동 기록은 아직 연동되지 않았어요.
        </p>
      </div>

      <section className="hike-complete-page__review" aria-labelledby="hike-review-question">
        <h2 id="hike-review-question" className="hike-complete-page__question">산 후기를 작성하시겠어요?</h2>
        <div className="hike-complete-page__actions">
          <Button fullWidth label="산 후기 작성" onClick={() => onWriteReview(result.mountainId, finishedAt)} />
          <Button fullWidth variant="secondary" label="나중에" onClick={backToCalendar} />
        </div>
      </section>
    </main>
    <BottomNavigation className="hike-page__nav" active="myHikes" onNavigate={navigateTab} />
  </div>;
}
