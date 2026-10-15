import { useId, useState, type FormEvent } from "react";
import { toDateKey } from "../../api/hikeMock";
import { useSingleFlight } from "../../hooks/useSingleFlight";
import { deleteSchedule, findSchedule, saveSchedule } from "../../store/hikeScheduleStore";
import type { HikeSchedule } from "../../types/hike";
import { Button } from "../common/Button";
import { Field } from "../common/Field";
import { Icon } from "../common/Icon";
import { BottomSheet, ConfirmOverlay, OverlayLayer } from "../overlay";
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

type Feedback = { tone: "error" | "success"; message: string; field?: "date" | "time" };

function validate(date: string, time: string, today: string): Feedback | null {
  if (!date) return { tone: "error", field: "date", message: "등산할 날짜를 선택해 주세요." };
  if (date < today) return { tone: "error", field: "date", message: "오늘 이전 날짜는 선택할 수 없어요." };
  if (!time) return { tone: "error", field: "time", message: "등산 시작 시간을 선택해 주세요." };
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
  const [date, setDate] = useState(schedule?.date ?? "");
  const [time, setTime] = useState(schedule?.startTime ?? "");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingReplace, setPendingReplace] = useState<HikeSchedule | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isEdit = variant === "edit";
  const hasSchedule = current !== undefined;
  const title = isEdit ? "등산 일정 수정" : "등산 일정 등록";

  const commit = (next: HikeSchedule, replaced: boolean) => {
    saveSchedule(next, current?.date);
    setCurrent(next);
    setPendingReplace(null);
    setFeedback({
      tone: "success",
      message: hasSchedule ? "일정이 수정되었습니다." : `${next.date} ${next.startTime} · ${next.courseName} 일정이 등록되었습니다.`,
    });
    onSaved?.(next, { created: !hasSchedule, replaced });
  };

  const { run: submit, pending } = useSingleFlight(async (event: FormEvent) => {
    event.preventDefault();
    const error = validate(date, time, today);
    if (error) {
      setFeedback(error);
      return;
    }
    const next: HikeSchedule = { ...course, date, startTime: time };
    const existing = findSchedule(date);
    // 수정 중인 자기 일정이 아닌, 같은 날짜의 다른 일정이 있으면 대체할지 묻는다.
    if (existing && existing.date !== current?.date) setPendingReplace(next);
    else commit(next, false);
  });

  const onDateChange = (value: string) => {
    setDate(value);
    if (feedback?.field === "date" || feedback?.tone === "success") setFeedback(null);
  };
  const onTimeChange = (value: string) => {
    setTime(value);
    if (feedback?.field === "time" || feedback?.tone === "success") setFeedback(null);
  };

  const describedBy = feedback ? feedbackId : undefined;
  const replacing = pendingReplace ? findSchedule(pendingReplace.date) : undefined;

  return <>
    <OverlayLayer placement="bottom" onDismiss={onClose}>
      <BottomSheet className={["af-schedule-sheet", isEdit && "af-schedule-sheet--edit"].filter(Boolean).join(" ")}
        role="dialog" aria-modal="true" title={title} showDescription={!isEdit}
        description={`${course.mountainName} · ${course.courseName}`} onClose={onClose}
        content={<form id={`${feedbackId}-form`} className="af-schedule-sheet__form" noValidate onSubmit={event => void submit(event)}>
          <Field type="date" label="등산할 날짜" helper="" min={today} value={date}
            state={feedback?.field === "date" ? "error" : date ? "value" : "empty"}
            aria-describedby={feedback?.field === "date" ? describedBy : undefined}
            onChange={event => onDateChange(event.target.value)} />
          <Field type="time" label="등산 시작 시간" helper="" placeholder="--:--" value={time}
            icon={<Icon name="Clock" size={20} color="#83978a" />}
            state={feedback?.field === "time" ? "error" : time ? "value" : "empty"}
            aria-describedby={feedback?.field === "time" ? describedBy : undefined}
            onChange={event => onTimeChange(event.target.value)} />
          <p id={feedbackId} className={`af-schedule-sheet__feedback af-schedule-sheet__feedback--${feedback?.tone ?? "none"}`}
            role={feedback?.tone === "error" ? "alert" : "status"}>{feedback?.message}</p>
        </form>}
        showFooter
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
