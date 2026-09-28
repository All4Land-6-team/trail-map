package com.all4land.trailmap.domain.example.exception;

import com.all4land.trailmap.domain.example.error.ExampleErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class ExampleException extends BaseException {

    public ExampleException(ExampleErrorCode errorCode) {
        super(errorCode);
    }
}
