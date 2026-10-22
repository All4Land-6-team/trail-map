package com.all4land.trailmap.domain.terrain.error;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

import static com.all4land.trailmap.global.constant.HttpStatusCode.BAD_REQUEST;
import static com.all4land.trailmap.global.constant.HttpStatusCode.INTERNAL_SERVER_ERROR;
import static com.all4land.trailmap.global.constant.HttpStatusCode.NOT_FOUND;

@Getter
@AllArgsConstructor
public enum TerrainErrorCode implements BaseResponseCode {
    INVALID_TILE_COORDINATE("TERRAIN_400_1", BAD_REQUEST, "타일 좌표가 올바르지 않습니다."),
    TILE_NOT_FOUND("TERRAIN_404_1", NOT_FOUND, "Terrain 타일을 찾을 수 없습니다."),
    TERRAIN_DATA_UNAVAILABLE("TERRAIN_500_1", INTERNAL_SERVER_ERROR, "Terrain 데이터를 사용할 수 없습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
