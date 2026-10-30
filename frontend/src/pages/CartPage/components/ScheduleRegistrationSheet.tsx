import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/common/Button";
import {
  DateTimePicker,
  formatTimeValue,
  getNextAvailableTime,
  isTimeAtOrAfter,
  toLocalDateKey,
} from "../../../components/common/DateTimePicker";
import { Typography } from "../../../components/common/Typography";
import { BottomSheet, ConfirmDialog, ModalLayer } from "../../../components/overlay";
import type { PlannedHike } from "../../../types/hiking";
import { formatCourseDuration } from "../data";
import type { CartCourse } from "../types";

type ScheduleRegistrationSheetProps = {
  courses: readonly CartCourse[];
  courseSummaries?: Readonly<Record<string, string>>;
  initialCourseId?: string;
  selectCourseFirst?: boolean;
  onClose: () => void;
  initialDate?: string;
  initialTime?: string;
  existingSchedules?: readonly PlannedHike[];
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
  courseSummaries,
  initialCourseId,
  selectCourseFirst = false,
  initialDate = getDefaultHikeDate(),
  initialTime = "09:00",
  existingSchedules = [],
  onClose,
  onConfirm,
}: ScheduleRegistrationSheetProps) {
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId ?? courses[0]?.id ?? "");
  const [step, setStep] = useState<"course" | "schedule">(selectCourseFirst ? "course" : "schedule");
  const [scheduleDate, setScheduleDate] = useState(initialDate);
  const [scheduleTime, setScheduleTime] = useState(initialTime);
  const [activePicker, setActivePicker] = useState<"date" | "time" | null>(null);
  const [replacementSchedule, setReplacementSchedule] = useState<PlannedHike | null>(null);
  const [now, setNow] = useState(() => new Date());
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

  if (!selectedCourse) return null;

  function submitSchedule() {
    const freshValidity = getScheduleValidity(scheduleDate, scheduleTime, new Date());
    if (!freshValidity.valid) return;
    const existing = existingSchedules.find((schedule) => (
      schedule.date === scheduleDate && schedule.courseId !== selectedCourse.id
    ));
    if (existing) {
      setReplacementSchedule(existing);
      return;
    }
    onConfirm(selectedCourse.id, { date: scheduleDate, time: scheduleTime });
  }

  return (
    <ModalLayer className="cart-schedule-overlay" onDismiss={onClose}>
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
                      {courseSummaries?.[course.id] ?? `${course.distanceKm} km · ${formatCourseDuration(course.durationMinutes)}`}
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
                submitSchedule();
              }
            }}
          >
            {step === "course" ? "다음" : "일정 확정"}
          </Button>
        )}
      />
      {replacementSchedule && (
        <ModalLayer className="cart-replacement-overlay" onDismiss={() => setReplacementSchedule(null)}>
          <ConfirmDialog
            className="cart-replacement-dialog"
            title={`${scheduleDate}에는 이미 '${replacementSchedule.mountain} · ${replacementSchedule.courseName}' 일정이 있어요.`}
            body="새 일정으로 바꿀까요?"
            cancelLabel="취소"
            confirmLabel="확인"
            onCancel={() => setReplacementSchedule(null)}
            onConfirm={() => onConfirm(selectedCourse.id, { date: scheduleDate, time: scheduleTime })}
          />
        </ModalLayer>
      )}
    </ModalLayer>
  );
}
