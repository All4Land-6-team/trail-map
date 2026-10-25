package com.all4land.trailmap.domain.facility.exception;

import com.all4land.trailmap.domain.facility.error.FacilityErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class FacilityException extends BaseException {
    public FacilityException(FacilityErrorCode code) {
        super(code);
    }
}
