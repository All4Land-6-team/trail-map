package com.all4land.trailmap.domain.hike.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** @param scheduleId 시작할 오늘 일정 */
public record HikeRecordStartRequest(
        @NotNull @Positive Long scheduleId
) {
}
