package com.all4land.trailmap.global.exception;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.Getter;

@Getter
public class BaseException extends RuntimeException {

    private final BaseResponseCode responseCode;

    public BaseException(BaseResponseCode responseCode) {
        super(responseCode.getMessage());
        this.responseCode = responseCode;
    }
}
