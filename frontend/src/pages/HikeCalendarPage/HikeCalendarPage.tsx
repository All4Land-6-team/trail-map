import { useState } from "react";
import { toDateKey } from "../../api/hikeMock";
import { Button } from "../../components/common/Button";
import { Calendar } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { navigate, readHashParams } from "../../hooks/useHashRoute";
import { useHikeSchedules } from "../../store/hikeScheduleStore";
import { useHikeSession } from "../../store/hikeSessionStore";
import { useScheduleDateStatus, useScheduleRecord } from "../../store/scheduleRecord";
import { hikePaths, leaveMyHikes, navigateTab } from "../hikeRoutes";
import { formatDateTitle, parseDateKey } from "../../utils/hikeFormat";
import { NicknameCard } from "./components/NicknameCard";
import { PlanCard } from "./components/PlanCard";
import { CompletedRecordCard, InProgressRecordCard } from "./components/RecordCard";
import "../hikePages.css";
import "./HikeCalendarPage.css";

/** `?date=YYYY-MM-DD`로 들어오면 그 날짜를, 아니면 오늘을 선택한다. */
function initialDate() {
  const value = readHashParams().get("date");
  const date = value ? parseDateKey(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** HIKE-01 내 등산 캘린더 (`#hikes/calendar`). 지난 날짜를 고르면 REC-01 완료한 등산 · REC-02 진행중 등산 카드를 보여 준다. */
export function HikeCalendarPage() {
  const schedules = useHikeSchedules();
  const [selected, setSelected] = useState(initialDate);
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  const selectedKey = toDateKey(selected);
  const schedule = schedules.find(item => item.date === selectedKey);
  const record = useScheduleRecord(schedule);
  const dateStatus = useScheduleDateStatus(schedules);
  const session = useHikeSession();

  return <div className="hike-page hike-calendar-page">
    <TopBar title="내 등산" showAction={false} onBack={leaveMyHikes} />
    <main className="hike-page__body hike-calendar-page__body">
      <NicknameCard />
      <Calendar className="hike-calendar-page__calendar" month={month} selectedDate={selected}
        scheduledDates={schedules.map(item => item.date)} completedDates={dateStatus.completed}
        inProgressDates={dateStatus.inProgress} onMonthChange={setMonth} onDateSelect={setSelected} />
      <section className="hike-calendar-page__day" aria-live="polite">
        <h2 className="hike-calendar-page__date">{formatDateTitle(selected)}</h2>
        {schedule && record?.status === "COMPLETED" ? <>
          <CompletedRecordCard schedule={schedule} record={record} />
          <Button fullWidth className="hike-calendar-page__record-button" label="등산 기록 보기"
            onClick={() => navigate(hikePaths.record(schedule.date))} />
        </> : schedule && record ? <>
          <InProgressRecordCard schedule={schedule} record={record} />
          {/* 마지막 진행 상태 화면으로 돌아간다: 등산 중 → HIKE-05, 하산 중 → HIKE-07 */}
          <Button fullWidth className="hike-calendar-page__record-button"
            label={record.status === "DESCENDING" ? "하산중 화면 보기" : "등산중 화면 보기"}
            onClick={() => navigate(record.status === "DESCENDING" ? hikePaths.downhill(session?.alertsOn ?? false)
              : hikePaths.active(session?.alertsOn ?? false))} />
        </>
        : schedule
          // 날짜가 지났는데 등산하지 않은 일정은 일정 상세로 들어가지 않는다.
          ? <PlanCard schedule={schedule}
            onOpen={selectedKey < toDateKey(new Date()) ? undefined : () => navigate(hikePaths.detail(schedule.date))} />
          : <p className="hike-calendar-page__empty">선택한 날짜에 등록된 등산 일정이 없어요.</p>}
      </section>
    </main>
    <BottomNavigation className="hike-page__nav" active="myHikes" onNavigate={navigateTab} />
  </div>;
}
