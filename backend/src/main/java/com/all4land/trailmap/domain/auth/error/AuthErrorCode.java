package com.all4land.trailmap.domain.auth.error;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

import static com.all4land.trailmap.global.constant.HttpStatusCode.CONFLICT;
import static com.all4land.trailmap.global.constant.HttpStatusCode.UNAUTHORIZED;

@Getter
@AllArgsConstructor
public enum AuthErrorCode implements BaseResponseCode {
    EMAIL_ALREADY_EXISTS("AUTH_409_1", CONFLICT, "이미 가입된 이메일입니다."),
    INVALID_CREDENTIALS("AUTH_401_1", UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."),
    AUTHENTICATION_REQUIRED("AUTH_401_2", UNAUTHORIZED, "로그인이 필요합니다."),
    INVALID_SESSION("AUTH_401_3", UNAUTHORIZED, "로그인 세션이 만료되었거나 올바르지 않습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
