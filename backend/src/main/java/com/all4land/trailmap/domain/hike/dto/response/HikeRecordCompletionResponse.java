package com.all4land.trailmap.domain.hike.dto.response;

import com.all4land.trailmap.domain.hike.repository.HikeRecordCompletion;

import java.time.OffsetDateTime;

public record HikeRecordCompletionResponse(
        Long hikeRecordId,
        Long scheduleId,
        Long courseId,
        OffsetDateTime endedAt
) {
    public static HikeRecordCompletionResponse from(HikeRecordCompletion completion) {
        return new HikeRecordCompletionResponse(
                completion.hikeRecordId(), completion.scheduleId(), completion.courseId(), completion.endedAt()
        );
    }
}
