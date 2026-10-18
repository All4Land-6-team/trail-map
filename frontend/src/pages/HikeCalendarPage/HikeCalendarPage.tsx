import { useState } from "react";
import { toDateKey } from "../../api/hikeMock";
import { Calendar } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { navigate, readHashParams } from "../../hooks/useHashRoute";
import { useHikeSchedules } from "../../store/hikeScheduleStore";
import { hikePaths, leaveMyHikes, navigateTab } from "../hikeRoutes";
import { formatDateTitle, parseDateKey } from "../../utils/hikeFormat";
import { NicknameCard } from "./components/NicknameCard";
import { PlanCard } from "./components/PlanCard";
import "../hikePages.css";
import "./HikeCalendarPage.css";

/** `?date=YYYY-MM-DD`로 들어오면 그 날짜를, 아니면 오늘을 선택한다. */
function initialDate() {
  const value = readHashParams().get("date");
  const date = value ? parseDateKey(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** HIKE-01 내 등산 캘린더 (`#hikes/calendar`) */
export function HikeCalendarPage() {
  const schedules = useHikeSchedules();
  const [selected, setSelected] = useState(initialDate);
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  const selectedKey = toDateKey(selected);
  const schedule = schedules.find(item => item.date === selectedKey);

  return <div className="hike-page hike-calendar-page">
    <main className="hike-page__body hike-calendar-page__body">
      <TopBar title="내 등산" showAction={false} onBack={leaveMyHikes} />
      <NicknameCard />
      <Calendar className="hike-calendar-page__calendar" month={month} selectedDate={selected}
        scheduledDates={schedules.map(item => item.date)} onMonthChange={setMonth} onDateSelect={setSelected} />
      <section className="hike-calendar-page__day" aria-live="polite">
        <h2 className="hike-calendar-page__date">{formatDateTitle(selected)}</h2>
        {schedule
          ? <PlanCard schedule={schedule} onOpen={() => navigate(hikePaths.detail(schedule.date))} />
          : <p className="hike-calendar-page__empty">선택한 날짜에 등록된 등산 일정이 없어요.</p>}
      </section>
    </main>
    <BottomNavigation className="hike-page__nav" active="myHikes" onNavigate={navigateTab} />
  </div>;
}
