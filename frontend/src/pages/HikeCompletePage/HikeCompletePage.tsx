import { sampleHikeResult } from "../../api/hikeMock";
import { Button } from "../../components/common/Button";
import { Icon } from "../../components/common/Icon";
import { Toast } from "../../components/feedback";
import { BottomNavigation } from "../../components/layout";
import { navigate } from "../../hooks/useHashRoute";
import { useToastMessage } from "../../hooks/useToastMessage";
import { formatDuration } from "../../utils/hikeFormat";
import { hikePaths, navigateTab } from "../hikeRoutes";
import "../hikePages.css";
import "./HikeCompletePage.css";

/** HIKE-08 등산 완료 (`#hikes/complete`) */
export function HikeCompletePage() {
  const result = sampleHikeResult;
  const toast = useToastMessage();
  // 나중에 → 오늘 날짜가 선택된 HIKE-01 캘린더
  const backToCalendar = () => navigate(hikePaths.calendar());

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
        <div><dt>이동 거리</dt><dd>{result.distanceKm.toFixed(1)} km</dd></div>
        <div><dt>소요 시간</dt><dd>{formatDuration(result.durationMinutes)}</dd></div>
      </dl>

      <div className="hike-complete-page__sunset">
        <p className="hike-complete-page__sunset-time">일몰 {result.sunset}</p>
        <p className="hike-complete-page__sunset-note">
          {result.finishedBeforeSunset ? "일몰 전에 등산을 마쳤어요." : "일몰 후에 등산을 마쳤어요."}
        </p>
      </div>

      <section className="hike-complete-page__review" aria-labelledby="hike-review-question">
        <h2 id="hike-review-question" className="hike-complete-page__question">산 후기를 작성하시겠어요?</h2>
        <div className="hike-complete-page__actions">
          <Button fullWidth label="산 후기 작성" onClick={() => toast.show("산 후기 작성(COMM-05)은 아직 준비 중이에요")} />
          <Button fullWidth variant="secondary" label="나중에" onClick={backToCalendar} />
        </div>
      </section>
      {toast.message && <Toast className="hike-page__toast" message={toast.message} />}
    </main>
    <BottomNavigation className="hike-page__nav" active="myHikes" onNavigate={navigateTab} />
  </div>;
}
