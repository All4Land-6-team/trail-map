package com.all4land.trailmap.domain.hike.exception;

import com.all4land.trailmap.domain.hike.error.HikeErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class HikeException extends BaseException {

    public HikeException(HikeErrorCode errorCode) {
        super(errorCode);
    }
}
