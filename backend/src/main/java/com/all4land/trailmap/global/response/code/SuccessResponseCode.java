package com.all4land.trailmap.global.response.code;

import lombok.AllArgsConstructor;
import lombok.Getter;

import static com.all4land.trailmap.global.constant.HttpStatusCode.CREATED;
import static com.all4land.trailmap.global.constant.HttpStatusCode.OK;

@Getter
@AllArgsConstructor
public enum SuccessResponseCode implements BaseResponseCode {
    SUCCESS_OK("SUCCESS_200", OK, "호출에 성공했습니다."),
    SUCCESS_CREATED("SUCCESS_201", CREATED, "생성에 성공했습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
