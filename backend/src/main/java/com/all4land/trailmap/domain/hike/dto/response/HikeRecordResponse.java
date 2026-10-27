package com.all4land.trailmap.domain.hike.dto.response;

import com.all4land.trailmap.domain.hike.entity.HikeRecordStatus;
import com.all4land.trailmap.domain.hike.repository.HikeCourseSummary;
import com.all4land.trailmap.domain.hike.repository.HikeRecordRow;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * @param traveledDistanceMeters 지금까지 이동한 거리. 위치를 받지 않았으면 null
 * @param actualDurationSeconds  종료 시 계산한 소요 시간. 진행 중이면 null
 * @param traveledPath           이동 경로 좌표 [경도, 위도] 목록
 */
public record HikeRecordResponse(
        Long hikeRecordId,
        Long scheduleId,
        Long courseId,
        String courseName,
        Long mountainId,
        String mountainName,
        HikeRecordStatus status,
        OffsetDateTime startedAt,
        OffsetDateTime endedAt,
        Double traveledDistanceMeters,
        Integer actualDurationSeconds,
        List<List<Double>> traveledPath
) {

    public static HikeRecordResponse of(HikeRecordRow record, HikeCourseSummary course, List<List<Double>> traveledPath) {
        return new HikeRecordResponse(
                record.hikeRecordId(),
                record.scheduleId(),
                course.courseId(),
                course.courseName(),
                course.mountainId(),
                course.mountainName(),
                record.status(),
                record.startedAt(),
                record.endedAt(),
                record.traveledDistanceMeters(),
                record.actualDurationSeconds(),
                traveledPath
        );
    }
}
