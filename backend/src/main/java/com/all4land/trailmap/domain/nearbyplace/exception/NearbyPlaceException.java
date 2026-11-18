package com.all4land.trailmap.domain.nearbyplace.exception;

import com.all4land.trailmap.domain.nearbyplace.error.NearbyPlaceErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class NearbyPlaceException extends BaseException {
    public NearbyPlaceException(NearbyPlaceErrorCode code) {
        super(code);
    }
}
