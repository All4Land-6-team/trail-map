package com.all4land.trailmap.domain.community.dto.response;

import java.time.OffsetDateTime;

public record EligibleHikeResponse(
        Long hikeRecordId,
        Long courseId,
        String courseName,
        OffsetDateTime endedAt
) {
}
