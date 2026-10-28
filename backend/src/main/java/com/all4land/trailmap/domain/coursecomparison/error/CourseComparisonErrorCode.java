package com.all4land.trailmap.domain.coursecomparison.error;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

import static com.all4land.trailmap.global.constant.HttpStatusCode.BAD_REQUEST;
import static com.all4land.trailmap.global.constant.HttpStatusCode.NOT_FOUND;

@Getter
@AllArgsConstructor
public enum CourseComparisonErrorCode implements BaseResponseCode {
    INVALID_SELECTION("COMPARISON_400_1", BAD_REQUEST, "서로 다른 양의 정수 코스 ID를 2~3개 지정해야 합니다."),
    DIFFERENT_MOUNTAINS("COMPARISON_400_2", BAD_REQUEST, "같은 산에 속한 코스만 비교할 수 있습니다."),
    COURSE_NOT_FOUND("COMPARISON_404_1", NOT_FOUND, "비교할 코스 중 존재하지 않는 코스가 있습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
