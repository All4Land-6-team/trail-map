package com.all4land.trailmap.domain.community.exception;

import com.all4land.trailmap.domain.community.error.CommunityErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class CommunityException extends BaseException {

    public CommunityException(CommunityErrorCode errorCode) {
        super(errorCode);
    }
}
