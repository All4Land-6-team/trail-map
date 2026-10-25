package com.all4land.trailmap.domain.community.dto.request;

import com.all4land.trailmap.domain.community.entity.CommunitySpotType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CommunitySpotCreateRequest(
        @NotNull @Positive Long hikeRecordId,
        @NotNull CommunitySpotType type,
        @NotBlank @Size(max = 40) String name,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
        boolean confirmDistinct
) {
}
