package com.all4land.trailmap.domain.hike.dto.request;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * @param date            출발 날짜 (YYYY-MM-DD, Asia/Seoul)
 * @param startTime       출발 시각 (HH:mm, Asia/Seoul)
 * @param replaceExisting 같은 날짜의 기존 일정을 삭제하고 대체할지 여부
 */
public record HikeScheduleCreateRequest(
        @NotNull @Positive Long courseId,
        @NotNull LocalDate date,
        @NotNull @JsonFormat(pattern = "HH:mm") LocalTime startTime,
        boolean replaceExisting
) {
}
