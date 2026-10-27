package com.all4land.trailmap.domain.hike.dto.response;

/**
 * @param acceptedCount          경로에 반영한 위치 수 (정확도가 낮거나 직전 위치와 너무 가까운 위치는 제외)
 * @param traveledDistanceMeters 반영 후 이동 거리. 아직 반영한 위치가 없으면 null
 */
public record HikePositionsResponse(
        Long hikeRecordId,
        int acceptedCount,
        Double traveledDistanceMeters
) {
}
