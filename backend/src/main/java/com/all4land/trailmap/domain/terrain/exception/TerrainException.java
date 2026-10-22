package com.all4land.trailmap.domain.terrain.exception;

import com.all4land.trailmap.domain.terrain.error.TerrainErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class TerrainException extends BaseException {

    public TerrainException(TerrainErrorCode errorCode) {
        super(errorCode);
    }
}
