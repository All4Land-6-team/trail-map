package com.all4land.trailmap.domain.user.exception;

import com.all4land.trailmap.domain.user.error.UserErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class UserException extends BaseException {

    public UserException(UserErrorCode errorCode) {
        super(errorCode);
    }
}
