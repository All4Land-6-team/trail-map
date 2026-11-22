import { HikeScheduleApiError } from "../api/hikeScheduleApi";

export const ALREADY_DELETED_SCHEDULE_MESSAGE = "이미 삭제된 일정이에요.";

/** 두 일정 등록창에서 동일한 저장·삭제 실패 안내를 사용한다. */
export function scheduleErrorMessage(error: unknown, action = "저장") {
  if (error instanceof HikeScheduleApiError && (error.kind === "unsupportedCourse" || error.kind === "activeHike" || error.kind === "completedHike")) return error.message;
  if (error instanceof HikeScheduleApiError && error.kind === "network") return `서버에 연결하지 못해 일정을 ${action}하지 못했어요.`;
  return `일정을 ${action}하지 못했어요. 잠시 후 다시 시도해 주세요.`;
}
