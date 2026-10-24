package com.all4land.trailmap.domain.hike.dto.request;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;
import java.time.LocalTime;

/** 보낸 항목만 수정한다. 날짜를 옮길 때 그 날짜에 일정이 있으면 replaceExisting으로 대체할 수 있다. */
public record HikeScheduleUpdateRequest(
        @Positive Long courseId,
        LocalDate date,
        @JsonFormat(pattern = "HH:mm") LocalTime startTime,
        boolean replaceExisting
) {

    public boolean isEmpty() {
        return courseId == null && date == null && startTime == null;
    }
}
