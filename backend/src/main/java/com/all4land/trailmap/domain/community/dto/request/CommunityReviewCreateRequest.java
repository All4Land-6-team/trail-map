package com.all4land.trailmap.domain.community.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public record CommunityReviewCreateRequest(
        @NotNull @Positive Long hikeRecordId,
        @NotBlank @Size(max = 1000) String content,
        @Min(1) @Max(5) Integer rating,
        OffsetDateTime environmentCapturedAt,
        @Min(-1080) @Max(1080) Integer environmentUtcOffsetMinutes
) {
}
