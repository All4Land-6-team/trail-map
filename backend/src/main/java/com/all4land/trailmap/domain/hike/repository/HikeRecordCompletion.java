package com.all4land.trailmap.domain.hike.repository;

import java.time.OffsetDateTime;

public record HikeRecordCompletion(
        Long hikeRecordId,
        Long scheduleId,
        Long courseId,
        OffsetDateTime endedAt
) {
}
