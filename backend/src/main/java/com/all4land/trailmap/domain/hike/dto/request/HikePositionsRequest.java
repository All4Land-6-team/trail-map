package com.all4land.trailmap.domain.hike.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

/** 기기가 모아 둔 GPS 위치 묶음. 네트워크가 끊겼던 동안의 위치도 한 번에 보낼 수 있다. */
public record HikePositionsRequest(
        @NotEmpty @Size(max = 500) List<@Valid @NotNull Position> positions
) {

    /**
     * @param longitude      경도 (EPSG:4326)
     * @param latitude       위도 (EPSG:4326)
     * @param recordedAt     기기에서 위치를 측정한 시각
     * @param accuracyMeters 위치 API가 알려 준 수평 정확도. 없으면 걸러내지 않는다.
     */
    public record Position(
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull OffsetDateTime recordedAt,
            @PositiveOrZero Double accuracyMeters
    ) {
    }
}
