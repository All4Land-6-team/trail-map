package com.all4land.trailmap.domain.community.repository;

import java.time.OffsetDateTime;

public record EligibleHikeQueryResult(
        Long hikeRecordId,
        Long courseId,
        String courseName,
        Long mountainId,
        OffsetDateTime endedAt
) {
}
