package com.all4land.trailmap.domain.hike.controller;

import com.all4land.trailmap.domain.hike.dto.request.HikeScheduleCreateRequest;
import com.all4land.trailmap.domain.hike.dto.request.HikeScheduleUpdateRequest;
import com.all4land.trailmap.domain.hike.dto.response.HikeScheduleResponse;
import com.all4land.trailmap.domain.hike.dto.response.HikeRecordCompletionResponse;
import com.all4land.trailmap.domain.hike.service.HikeScheduleService;
import com.all4land.trailmap.global.response.SuccessResponse;
import com.all4land.trailmap.global.user.CurrentUserId;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/v1/hike-schedules")
@RequiredArgsConstructor
public class HikeScheduleController {

    private final HikeScheduleService hikeScheduleService;

    @PostMapping
    public ResponseEntity<SuccessResponse<HikeScheduleResponse>> createSchedule(
            @CurrentUserId Long userId,
            @Valid @RequestBody HikeScheduleCreateRequest request
    ) {
        return response(SuccessResponse.created(hikeScheduleService.create(userId, request)));
    }

    @GetMapping
    public ResponseEntity<SuccessResponse<List<HikeScheduleResponse>>> getSchedules(
            @CurrentUserId Long userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return response(SuccessResponse.ok(hikeScheduleService.getSchedules(userId, from, to)));
    }

    @GetMapping("/{scheduleId}")
    public ResponseEntity<SuccessResponse<HikeScheduleResponse>> getSchedule(
            @CurrentUserId Long userId,
            @PathVariable Long scheduleId
    ) {
        return response(SuccessResponse.ok(hikeScheduleService.getSchedule(userId, scheduleId)));
    }

    @PatchMapping("/{scheduleId}")
    public ResponseEntity<SuccessResponse<HikeScheduleResponse>> updateSchedule(
            @CurrentUserId Long userId,
            @PathVariable Long scheduleId,
            @Valid @RequestBody HikeScheduleUpdateRequest request
    ) {
        return response(SuccessResponse.ok(hikeScheduleService.update(userId, scheduleId, request)));
    }

    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<SuccessResponse<Void>> deleteSchedule(
            @CurrentUserId Long userId,
            @PathVariable Long scheduleId
    ) {
        hikeScheduleService.delete(userId, scheduleId);
        return response(SuccessResponse.ok(null));
    }

    @PostMapping("/{scheduleId}/complete")
    public ResponseEntity<SuccessResponse<HikeRecordCompletionResponse>> completeSchedule(
            @CurrentUserId Long userId,
            @PathVariable Long scheduleId
    ) {
        return response(SuccessResponse.created(hikeScheduleService.complete(userId, scheduleId)));
    }

    private static <T> ResponseEntity<SuccessResponse<T>> response(SuccessResponse<T> body) {
        return ResponseEntity.status(body.getHttpStatus()).body(body);
    }
}
