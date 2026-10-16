import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/common/Button";
import {
  DateTimePicker,
  formatTimeValue,
  getNextAvailableTime,
  isTimeAtOrAfter,
  toLocalDateKey,
} from "../../../components/common/DateTimePicker";
import { Typography } from "../../../components/common/Typography";
import { BottomSheet } from "../../../components/overlay";
import { formatCourseDuration } from "../data";
import type { CartCourse } from "../types";

type ScheduleRegistrationSheetProps = {
  courses: readonly CartCourse[];
  initialCourseId?: string;
  selectCourseFirst?: boolean;
  onClose: () => void;
  initialDate?: string;
  initialTime?: string;
  onConfirm: (courseId: string, schedule: HikingScheduleValue) => void;
};

export type HikingScheduleValue = {
  date: string;
  time: string;
};

function getDefaultHikeDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toLocalDateKey(date);
}

function getCurrentTime(date: Date) {
  return formatTimeValue(date.getHours(), date.getMinutes());
}

function getScheduleValidity(date: string, time: string, now: Date) {
  const today = toLocalDateKey(now);
  if (date < today) return { valid: false, today, earliestTime: undefined };
  const earliestTime = date === today ? getNextAvailableTime(getCurrentTime(now), 10) : undefined;
  return {
    valid: earliestTime !== null && isTimeAtOrAfter(time, earliestTime),
    today,
    earliestTime,
  };
}

export function ScheduleRegistrationSheet({
  courses,
  initialCourseId,
  selectCourseFirst = false,
  initialDate = getDefaultHikeDate(),
  initialTime = "09:00",
  onClose,
  onConfirm,
}: ScheduleRegistrationSheetProps) {
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId ?? courses[0]?.id ?? "");
  const [step, setStep] = useState<"course" | "schedule">(selectCourseFirst ? "course" : "schedule");
  const [scheduleDate, setScheduleDate] = useState(initialDate);
  const [scheduleTime, setScheduleTime] = useState(initialTime);
  const [activePicker, setActivePicker] = useState<"date" | "time" | null>(null);
  const [now, setNow] = useState(() => new Date());
  const overlayRef = useRef<HTMLDivElement>(null);
  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? courses[0],
    [courses, selectedCourseId],
  );
  const { valid: scheduleValid, today, earliestTime } = getScheduleValidity(scheduleDate, scheduleTime, now);

  useEffect(() => {
    const refreshNow = () => setNow(new Date());
    const intervalId = window.setInterval(refreshNow, 30_000);
    document.addEventListener("visibilitychange", refreshNow);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshNow);
    };
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = Array.from(overlay.parentElement?.children ?? []).filter((element) => element !== overlay) as HTMLElement[];
    const siblingInertState = siblings.map((element) => element.inert);
    siblings.forEach((element) => { element.inert = true; });
    const frameId = requestAnimationFrame(() => {
      overlay.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    });
    return () => {
      cancelAnimationFrame(frameId);
      siblings.forEach((element, index) => { element.inert = siblingInertState[index]; });
      previouslyFocused?.focus();
    };
  }, []);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(overlayRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => !element.closest('[inert]'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!selectedCourse) return null;

  return (
    <div ref={overlayRef} className="cart-schedule-overlay" role="presentation" onKeyDown={handleDialogKeyDown}>
      <BottomSheet
        role="dialog"
        aria-modal="true"
        title={step === "course" ? "일정으로 등록할 코스 선택" : "등산 일정 등록"}
        description={step === "course"
          ? "비교 중인 코스 중 1개를 선택해 주세요."
          : `${selectedCourse.mountain} · ${selectedCourse.name}`}
        showFooter={activePicker == null}
        onClose={onClose}
        className={`cart-schedule-sheet cart-schedule-sheet--${step}${activePicker ? " cart-schedule-sheet--picker-open" : ""}`}
        content={step === "course" ? (
          <div className="cart-schedule-course-list" role="radiogroup" aria-label="일정으로 등록할 코스">
            {courses.map((course) => {
              const selected = course.id === selectedCourse.id;
              return (
                <button
                  key={course.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className="cart-schedule-course"
                  onClick={() => setSelectedCourseId(course.id)}
                >
                  <span className="cart-schedule-radio">
                    {selected && <span />}
                  </span>
                  <span className="cart-course-line" style={{ backgroundColor: course.color }} />
                  <span className="cart-course-copy">
                    <Typography variant="controlLabel">{course.name}</Typography>
                    <Typography variant="descriptionSmall">
                      {course.distanceKm} km · {formatCourseDuration(course.durationMinutes)}
                    </Typography>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="cart-schedule-fields">
            <DateTimePicker
              dateLabel="등산할 날짜"
              timeLabel="등산 시작 시간"
              value={{ date: scheduleDate, time: scheduleTime }}
              minDate={today}
              minuteStep={10}
              minTime={earliestTime === null ? "24:00" : earliestTime}
              onPickerOpenChange={setActivePicker}
              onChange={(nextSchedule) => {
                let nextTime = nextSchedule.time;
                if (nextSchedule.date === today && nextSchedule.date !== scheduleDate) {
                  const earliestAvailable = getNextAvailableTime(getCurrentTime(new Date()), 10);
                  if (earliestAvailable && !isTimeAtOrAfter(nextTime, earliestAvailable)) nextTime = earliestAvailable;
                }
                setScheduleDate(nextSchedule.date);
                setScheduleTime(nextTime);
              }}
            />
          </div>
        )}
        footer={(
          <Button
            fullWidth
            disabled={step === "schedule" && !scheduleValid}
            onClick={() => {
              if (step === "course") {
                setStep("schedule");
                setActivePicker(null);
              } else {
                const freshValidity = getScheduleValidity(scheduleDate, scheduleTime, new Date());
                if (freshValidity.valid) onConfirm(selectedCourse.id, { date: scheduleDate, time: scheduleTime });
              }
            }}
          >
            {step === "course" ? "다음" : "일정 확정"}
          </Button>
        )}
      />
    </div>
  );
}
