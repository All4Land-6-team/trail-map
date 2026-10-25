package com.all4land.trailmap.domain.community.dto.request;

import com.all4land.trailmap.domain.community.entity.CommunitySpotType;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record CommunitySpotMapRequest(
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double west,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double south,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double east,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double north,
        CommunitySpotType type
) {

    @AssertTrue(message = "지도 조회 영역이 올바르지 않습니다.")
    public boolean isValidBounds() {
        return west == null || south == null || east == null || north == null
                || (west < east && south < north);
    }
}
