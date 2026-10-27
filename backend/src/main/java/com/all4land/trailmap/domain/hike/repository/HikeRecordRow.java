package com.all4land.trailmap.domain.hike.repository;

import com.all4land.trailmap.domain.hike.entity.HikeRecordStatus;

import java.time.OffsetDateTime;

/**
 * @param lastLongitude 이동 경로의 마지막 점 경도. 아직 위치를 받지 않았으면 null
 * @param lastLatitude  이동 경로의 마지막 점 위도. 아직 위치를 받지 않았으면 null
 */
public record HikeRecordRow(
        Long hikeRecordId,
        Long scheduleId,
        Long courseId,
        HikeRecordStatus status,
        OffsetDateTime startedAt,
        OffsetDateTime endedAt,
        Double traveledDistanceMeters,
        Integer actualDurationSeconds,
        Double lastLongitude,
        Double lastLatitude
) {

    public boolean isCompleted() {
        return status == HikeRecordStatus.COMPLETED;
    }
}
