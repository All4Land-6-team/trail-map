import { useId, useState, type FormEvent } from "react";
import { toDateKey } from "../../api/hikeMock";
import { useSingleFlight } from "../../hooks/useSingleFlight";
import { deleteSchedule, findSchedule, saveSchedule } from "../../store/hikeScheduleStore";
import type { HikeSchedule } from "../../types/hike";
import { Button } from "../common/Button";
import { DateTimePicker, formatTimeValue, getNextAvailableTime, isTimeAtOrAfter, type DateTimeValue } from "../common/DateTimePicker";
import { BottomSheet } from "../overlay";
import { ConfirmOverlay } from "./ConfirmOverlay";
import { OverlayLayer } from "./OverlayLayer";
import { ScheduleReplaceConfirm } from "./ScheduleReplaceConfirm";
import "./hike.css";

export type ScheduleCourse = Pick<HikeSchedule, "courseId" | "mountainName" | "courseName" | "distanceKm">;

export type ScheduleSaveResult = {
  /** 처음 등록한 일정인지 */
  created: boolean;
  /** 같은 날짜의 다른 일정을 대체했는지 */
  replaced: boolean;
};

export type ScheduleSheetProps = {
  course: ScheduleCourse;
  /** 이 코스에 이미 등록된 일정. 있으면 수정·삭제 상태로 연다. */
  schedule?: HikeSchedule;
  /**
   * register: FLOW-06 코스 화면에서 여는 등록 시트 (기존 일정이면 수정·삭제 버튼).
   * edit: HIKE-09 일정 상세에서 여는 수정 오버레이 (일정 저장 버튼만).
   */
  variant?: "register" | "edit";
  /** × 버튼, 배경 클릭, Esc */
  onClose: () => void;
  onSaved?: (schedule: HikeSchedule, result: ScheduleSaveResult) => void;
  onDeleted?: (schedule: HikeSchedule) => void;
};

/** 등산 시작 시간의 분은 10분 단위로 고른다. */
const MINUTE_STEP = 10;

type Feedback = { tone: "error" | "success"; message: string; field?: "date" | "time" };

/** 오늘 날짜에서 고를 수 있는 가장 이른 시간 (지금 이후 가장 가까운 10분). 오늘이 아니면 제한 없음. */
function earliestTimeOn(date: string, today: string) {
  if (date !== today) return undefined;
  const now = new Date();
  return getNextAvailableTime(formatTimeValue(now.getHours(), now.getMinutes()), MINUTE_STEP);
}

function validate({ date, time }: DateTimeValue, today: string): Feedback | null {
  if (!date) return { tone: "error", field: "date", message: "등산할 날짜를 선택해 주세요." };
  if (date < today) return { tone: "error", field: "date", message: "오늘 이전 날짜는 선택할 수 없어요." };
  if (!time) return { tone: "error", field: "time", message: "등산 시작 시간을 선택해 주세요." };
  const earliest = earliestTimeOn(date, today);
  if (earliest === null || !isTimeAtOrAfter(time, earliest)) return { tone: "error", field: "time", message: "지금 이후 시간을 선택해 주세요." };
  return null;
}

/** FLOW-06 등산 일정 등록/수정/삭제 시트, HIKE-09 일정 수정 오버레이. 일정은 날짜당 1개만 저장한다. */
export function ScheduleSheet({ course, schedule, variant = "register", onClose, onSaved, onDeleted }: ScheduleSheetProps) {
  const feedbackId = useId();
  const [today] = useState(() => toDateKey(new Date()));
  // 버튼 구성은 연 시점 기준이다. 새로 등록한 직후에도 Figma처럼 일정 확정 버튼을 유지한다.
  const [openedWithSchedule] = useState(schedule !== undefined);
  // 이 시트에서 저장한 뒤에는 저장한 일정을 기준으로 다시 수정한다.
  const [current, setCurrent] = useState(schedule);
  const [value, setValue] = useState<DateTimeValue>({ date: schedule?.date ?? "", time: schedule?.startTime ?? "" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingReplace, setPendingReplace] = useState<HikeSchedule | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isEdit = variant === "edit";
  const hasSchedule = current !== undefined;
  const title = isEdit ? "등산 일정 수정" : "등산 일정 등록";

  // 안내 문구는 시트를 연 목적 기준이다. 신규 등록으로 열었으면 다시 확정해도 등록 문구를 유지한다 (Figma FLOW-06 등록 성공).
  const successMessage = (saved: HikeSchedule) => openedWithSchedule || isEdit
    ? "일정이 수정되었습니다."
    : `${saved.date} ${saved.startTime} · ${saved.courseName} 일정이 등록되었습니다.`;

  const commit = (next: HikeSchedule, replaced: boolean) => {
    saveSchedule(next, current?.date);
    setCurrent(next);
    setPendingReplace(null);
    setFeedback({ tone: "success", message: successMessage(next) });
    onSaved?.(next, { created: !hasSchedule, replaced });
  };

  const { run: submit, pending } = useSingleFlight(async (event: FormEvent) => {
    event.preventDefault();
    const error = validate(value, today);
    if (error) {
      setFeedback(error);
      return;
    }
    // 방금 저장한 값 그대로 다시 확정하면 다시 저장하지 않고 안내만 유지한다.
    if (current && current.date === value.date && current.startTime === value.time && !openedWithSchedule && !isEdit) {
      setFeedback({ tone: "success", message: successMessage(current) });
      return;
    }
    const next: HikeSchedule = { ...course, date: value.date, startTime: value.time };
    const existing = findSchedule(value.date);
    // 수정 중인 자기 일정이 아닌, 같은 날짜의 다른 일정이 있으면 대체할지 묻는다.
    if (existing && existing.date !== current?.date) setPendingReplace(next);
    else commit(next, false);
  });

  const onValueChange = (next: DateTimeValue) => {
    // 오늘로 바꿨는데 이미 지난 시간이면 고를 수 있는 가장 이른 시간으로 맞춘다.
    const earliest = earliestTimeOn(next.date, today);
    const time = next.time && earliest && !isTimeAtOrAfter(next.time, earliest) ? earliest : next.time;
    setValue({ date: next.date, time });
    setFeedback(current => current?.tone === "success" || (current?.field === "date" && next.date)
      || (current?.field === "time" && time) ? null : current);
  };

  const replacing = pendingReplace ? findSchedule(pendingReplace.date) : undefined;

  return <>
    <OverlayLayer placement="bottom" aboveNav onDismiss={onClose}>
      <BottomSheet className={["af-schedule-sheet", isEdit && "af-schedule-sheet--edit"].filter(Boolean).join(" ")}
        role="dialog" aria-modal="true" title={title} showDescription={!isEdit}
        description={`${course.mountainName} · ${course.courseName}`} onClose={onClose}
        content={<form id={`${feedbackId}-form`} className="af-schedule-sheet__form" noValidate onSubmit={event => void submit(event)}>
          {/* 등산 담기 일정 등록과 같은 공용 날짜·시간 선택기. 칸 어디를 눌러도 열리고, 분은 10분 단위 */}
          <DateTimePicker dateLabel="등산할 날짜" timeLabel="등산 시작 시간" value={value}
            minDate={today} minuteStep={MINUTE_STEP} today={today}
            minTime={earliestTimeOn(value.date, today) ?? undefined}
            dateInvalid={feedback?.field === "date"} timeInvalid={feedback?.field === "time"}
            onPickerOpenChange={picker => setPickerOpen(picker !== null)} onChange={onValueChange} />
          <p id={feedbackId} className={`af-schedule-sheet__feedback af-schedule-sheet__feedback--${feedback?.tone ?? "none"}`}
            role={feedback?.tone === "error" ? "alert" : "status"}>{feedback?.message}</p>
        </form>}
        // 선택 창이 열려 있는 동안은 버튼을 숨겨 선택 창이 가려지지 않게 한다 (등산 담기 시트와 같음).
        showFooter={!pickerOpen}
        footer={openedWithSchedule && !isEdit
          ? <div className="af-schedule-sheet__actions">
            <Button type="submit" form={`${feedbackId}-form`} fullWidth label="일정 수정" disabled={pending} />
            <Button fullWidth variant="secondary" className="af-schedule-sheet__delete" label="일정 삭제"
              onClick={() => setConfirmingDelete(true)} />
          </div>
          : <Button type="submit" form={`${feedbackId}-form`} fullWidth label={isEdit ? "일정 저장" : "일정 확정"} disabled={pending} />} />
    </OverlayLayer>

    {pendingReplace && replacing && <ScheduleReplaceConfirm date={pendingReplace.date}
      existingCourseName={`${replacing.mountainName} · ${replacing.courseName}`}
      onCancel={() => setPendingReplace(null)} onConfirm={() => commit(pendingReplace, true)} />}
    {confirmingDelete && current && <ConfirmOverlay title="일정을 삭제할까요?"
      body={`${current.date} ${current.startTime} · ${current.mountainName} · ${current.courseName}`}
      cancelLabel="취소" confirmLabel="삭제" onCancel={() => setConfirmingDelete(false)}
      onConfirm={() => {
        deleteSchedule(current.date);
        setConfirmingDelete(false);
        onDeleted?.(current);
      }} />}
  </>;
}
