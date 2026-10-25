package com.all4land.trailmap.domain.community.dto.request;

import com.all4land.trailmap.domain.community.entity.CommunityPhotoTargetType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CommunityPhotoConfirmRequest(
        @NotNull CommunityPhotoTargetType targetType,
        @NotNull @Positive Long targetId,
        @NotBlank @Size(max = 1024) String objectKey,
        @NotBlank @Size(max = 255) String originalFileName,
        @NotBlank @Pattern(regexp = "image/(jpeg|png|webp)") String mediaType,
        @NotNull @Positive @Max(5_242_880) Long fileSizeBytes,
        @NotNull @Min(0) @Max(2) Integer displayOrder
) {
}
