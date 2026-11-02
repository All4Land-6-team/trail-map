package com.all4land.trailmap.domain.auth.exception;

import com.all4land.trailmap.domain.auth.error.AuthErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class AuthException extends BaseException {
    public AuthException(AuthErrorCode errorCode) {
        super(errorCode);
    }
}
