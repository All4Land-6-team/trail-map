package com.all4land.trailmap.domain.hike.controller;

import com.all4land.trailmap.domain.hike.dto.request.HikePositionsRequest;
import com.all4land.trailmap.domain.hike.dto.request.HikeRecordStartRequest;
import com.all4land.trailmap.domain.hike.dto.response.HikePositionsResponse;
import com.all4land.trailmap.domain.hike.dto.response.HikeRecordResponse;
import com.all4land.trailmap.domain.hike.service.HikeRecordService;
import com.all4land.trailmap.global.response.SuccessResponse;
import com.all4land.trailmap.global.user.CurrentUserId;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/hike-records")
@RequiredArgsConstructor
public class HikeRecordController {

    private final HikeRecordService hikeRecordService;

    @PostMapping
    public ResponseEntity<SuccessResponse<HikeRecordResponse>> startRecord(
            @CurrentUserId Long userId,
            @Valid @RequestBody HikeRecordStartRequest request
    ) {
        return response(SuccessResponse.created(hikeRecordService.start(userId, request)));
    }

    @GetMapping("/active")
    public ResponseEntity<SuccessResponse<HikeRecordResponse>> getActiveRecord(@CurrentUserId Long userId) {
        return response(SuccessResponse.ok(hikeRecordService.getActive(userId)));
    }

    @GetMapping("/{hikeRecordId}")
    public ResponseEntity<SuccessResponse<HikeRecordResponse>> getRecord(
            @CurrentUserId Long userId,
            @PathVariable Long hikeRecordId
    ) {
        return response(SuccessResponse.ok(hikeRecordService.getRecord(userId, hikeRecordId)));
    }

    @PostMapping("/{hikeRecordId}/positions")
    public ResponseEntity<SuccessResponse<HikePositionsResponse>> addPositions(
            @CurrentUserId Long userId,
            @PathVariable Long hikeRecordId,
            @Valid @RequestBody HikePositionsRequest request
    ) {
        return response(SuccessResponse.ok(hikeRecordService.addPositions(userId, hikeRecordId, request)));
    }

    @PostMapping("/{hikeRecordId}/descend")
    public ResponseEntity<SuccessResponse<HikeRecordResponse>> descend(
            @CurrentUserId Long userId,
            @PathVariable Long hikeRecordId
    ) {
        return response(SuccessResponse.ok(hikeRecordService.descend(userId, hikeRecordId)));
    }

    @PostMapping("/{hikeRecordId}/finish")
    public ResponseEntity<SuccessResponse<HikeRecordResponse>> finish(
            @CurrentUserId Long userId,
            @PathVariable Long hikeRecordId
    ) {
        return response(SuccessResponse.ok(hikeRecordService.finish(userId, hikeRecordId)));
    }

    private static <T> ResponseEntity<SuccessResponse<T>> response(SuccessResponse<T> body) {
        return ResponseEntity.status(body.getHttpStatus()).body(body);
    }
}
