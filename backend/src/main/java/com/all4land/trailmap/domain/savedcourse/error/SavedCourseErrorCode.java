package com.all4land.trailmap.domain.savedcourse.error;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

import static com.all4land.trailmap.global.constant.HttpStatusCode.NOT_FOUND;

@Getter
@AllArgsConstructor
public enum SavedCourseErrorCode implements BaseResponseCode {
    USER_NOT_FOUND("SAVED_404_1", NOT_FOUND, "사용자를 찾을 수 없습니다."),
    COURSE_NOT_FOUND("SAVED_404_2", NOT_FOUND, "코스를 찾을 수 없습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
