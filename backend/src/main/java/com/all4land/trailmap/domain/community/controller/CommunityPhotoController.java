package com.all4land.trailmap.domain.community.controller;

import com.all4land.trailmap.domain.community.dto.request.CommunityPhotoConfirmRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunityPhotoUploadUrlRequest;
import com.all4land.trailmap.domain.community.dto.response.CommunityPhotoResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityPhotoUploadUrlResponse;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.service.CommunityPhotoService;
import com.all4land.trailmap.global.response.SuccessResponse;
import com.all4land.trailmap.global.user.CurrentUserId;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/v1/community")
@RequiredArgsConstructor
public class CommunityPhotoController {

    private final CommunityPhotoService photoService;

    @PostMapping("/photos/upload-url")
    public ResponseEntity<SuccessResponse<CommunityPhotoUploadUrlResponse>> requestUploadUrl(
            @CurrentUserId Long userId,
            @Valid @RequestBody CommunityPhotoUploadUrlRequest request
    ) {
        return response(SuccessResponse.ok(photoService.requestUploadUrl(userId, request)));
    }

    @PostMapping("/photos")
    public ResponseEntity<SuccessResponse<CommunityPhotoResponse>> confirmPhoto(
            @CurrentUserId Long userId,
            @Valid @RequestBody CommunityPhotoConfirmRequest request
    ) {
        return response(SuccessResponse.created(photoService.confirmPhoto(userId, request)));
    }

    @GetMapping("/mountains/{mountainId}/photos")
    public ResponseEntity<SuccessResponse<List<CommunityPhotoResponse>>> getMountainPhotos(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId
    ) {
        return response(SuccessResponse.ok(photoService.getMountainPhotos(userId, mountainId)));
    }

    @GetMapping("/courses/{courseId}/photos")
    public ResponseEntity<SuccessResponse<List<CommunityPhotoResponse>>> getCoursePhotos(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long courseId
    ) {
        return response(SuccessResponse.ok(photoService.getCoursePhotos(userId, courseId)));
    }

    @GetMapping("/mountains/{mountainId}/spots/{targetType}/{targetId}/photos")
    public ResponseEntity<SuccessResponse<List<CommunityPhotoResponse>>> getSpotPhotos(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @PathVariable CommunitySpotTargetType targetType,
            @Positive @PathVariable Long targetId
    ) {
        return response(SuccessResponse.ok(
                photoService.getSpotPhotos(userId, mountainId, targetType, targetId)
        ));
    }

    @GetMapping("/photos/{photoId}")
    public ResponseEntity<SuccessResponse<CommunityPhotoResponse>> getPhoto(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long photoId
    ) {
        return response(SuccessResponse.ok(photoService.getPhoto(userId, photoId)));
    }

    private static <T> ResponseEntity<SuccessResponse<T>> response(SuccessResponse<T> body) {
        return ResponseEntity.status(body.getHttpStatus()).body(body);
    }
}
