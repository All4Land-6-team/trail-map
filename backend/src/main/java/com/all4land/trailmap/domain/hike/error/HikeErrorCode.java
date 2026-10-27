package com.all4land.trailmap.domain.hike.error;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

import static com.all4land.trailmap.global.constant.HttpStatusCode.BAD_REQUEST;
import static com.all4land.trailmap.global.constant.HttpStatusCode.CONFLICT;
import static com.all4land.trailmap.global.constant.HttpStatusCode.NOT_FOUND;

@Getter
@AllArgsConstructor
public enum HikeErrorCode implements BaseResponseCode {
    INVALID_SCHEDULE_PERIOD("HIKE_400_1", BAD_REQUEST, "일정 조회 기간이 올바르지 않습니다."),
    EMPTY_SCHEDULE_UPDATE("HIKE_400_2", BAD_REQUEST, "수정할 일정 항목이 없습니다."),
    USER_NOT_FOUND("HIKE_404_1", NOT_FOUND, "사용자를 찾을 수 없습니다."),
    COURSE_NOT_FOUND("HIKE_404_2", NOT_FOUND, "코스를 찾을 수 없습니다."),
    SCHEDULE_NOT_FOUND("HIKE_404_3", NOT_FOUND, "등산 일정을 찾을 수 없습니다."),
    RECORD_NOT_FOUND("HIKE_404_4", NOT_FOUND, "등산 기록을 찾을 수 없습니다."),
    SCHEDULE_ALREADY_EXISTS("HIKE_409_1", CONFLICT, "해당 날짜에 이미 등산 일정이 있습니다."),
    SCHEDULE_NOT_TODAY("HIKE_409_2", CONFLICT, "오늘 일정만 등산을 시작할 수 있습니다."),
    RECORD_ALREADY_EXISTS("HIKE_409_3", CONFLICT, "이미 등산 기록이 있는 일정입니다."),
    ACTIVE_RECORD_EXISTS("HIKE_409_4", CONFLICT, "진행 중인 등산이 있습니다."),
    RECORD_ALREADY_COMPLETED("HIKE_409_5", CONFLICT, "이미 종료된 등산입니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
