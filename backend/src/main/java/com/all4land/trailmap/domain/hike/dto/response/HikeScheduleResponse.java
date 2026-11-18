package com.all4land.trailmap.domain.hike.dto.response;

import com.all4land.trailmap.domain.hike.entity.HikeSchedule;
import com.all4land.trailmap.domain.hike.repository.HikeCourseSummary;
import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

public record HikeScheduleResponse(
        Long scheduleId,
        LocalDate date,
        @JsonFormat(pattern = "HH:mm") LocalTime startTime,
        Long courseId,
        String courseName,
        Long mountainId,
        String mountainName,
        Double distanceMeters,
        Integer durationSeconds,
        /** 이 일정의 등산 기록 요약. 아직 등산을 시작하지 않았으면 null */
        HikeScheduleRecordResponse hikeRecord
) {

    public static HikeScheduleResponse of(HikeSchedule schedule, HikeCourseSummary course, ZoneId zoneId) {
        return of(schedule, course, null, zoneId);
    }

    public static HikeScheduleResponse of(HikeSchedule schedule, HikeCourseSummary course,
                                          HikeScheduleRecordResponse hikeRecord, ZoneId zoneId) {
        ZonedDateTime startsAt = schedule.getScheduledStartsAt().atZoneSameInstant(zoneId);
        return new HikeScheduleResponse(
                schedule.getScheduleId(),
                startsAt.toLocalDate(),
                startsAt.toLocalTime(),
                course.courseId(),
                course.courseName(),
                course.mountainId(),
                course.mountainName(),
                course.distanceMeters(),
                course.durationSeconds(),
                hikeRecord
        );
    }
}
