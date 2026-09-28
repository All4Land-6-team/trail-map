package com.all4land.trailmap.domain.example.error;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

import static com.all4land.trailmap.global.constant.HttpStatusCode.NOT_FOUND;

@Getter
@AllArgsConstructor
public enum ExampleErrorCode implements BaseResponseCode {
    EXAMPLE_NOT_FOUND("EXAMPLE_404_1", NOT_FOUND, "예시 데이터를 찾을 수 없습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
