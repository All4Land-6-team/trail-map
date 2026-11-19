package com.all4land.trailmap.domain.hike.dto.response;

import com.all4land.trailmap.domain.hike.entity.HikeRecordStatus;

import java.time.OffsetDateTime;

/**
 * 일정에 연결된 등산 기록 요약. 캘린더의 완료·끝내지 않은 등산 표시와 카드(REC-01·02)에 쓴다.
 * 경로가 필요한 기록 상세(REC-03)는 GET /v1/hike-records/{hikeRecordId}로 조회한다.
 */
public record HikeScheduleRecordResponse(
        Long hikeRecordId,
        HikeRecordStatus status,
        OffsetDateTime startedAt,
        OffsetDateTime endedAt,
        Double traveledDistanceMeters,
        Integer actualDurationSeconds
) {
}
