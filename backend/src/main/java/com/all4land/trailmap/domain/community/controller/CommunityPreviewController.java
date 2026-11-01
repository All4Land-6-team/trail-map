package com.all4land.trailmap.domain.community.controller;

import com.all4land.trailmap.domain.community.dto.request.CommunityReviewPageRequest;
import com.all4land.trailmap.domain.community.dto.response.CommunityMountainPreviewResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityReviewPreviewResponse;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.service.CommunityPhotoService;
import com.all4land.trailmap.domain.community.service.CommunityQueryService;
import com.all4land.trailmap.global.response.SuccessResponse;
import com.all4land.trailmap.global.user.CurrentUserId;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/v1/community")
@RequiredArgsConstructor
public class CommunityPreviewController {

    private static final CommunityReviewPageRequest THREE_REVIEWS = new CommunityReviewPageRequest(3, 0);
    private final CommunityQueryService queryService;
    private final CommunityPhotoService photoService;

    @GetMapping("/mountains/{mountainId}/preview")
    public ResponseEntity<SuccessResponse<CommunityMountainPreviewResponse>> mountainPreview(
            @CurrentUserId Long userId, @Positive @PathVariable Long mountainId
    ) {
        var preview = new CommunityMountainPreviewResponse(
                queryService.getMountainReviewSummary(userId, mountainId),
                queryService.getMountainReviews(userId, mountainId, THREE_REVIEWS),
                photoService.getMountainPhotos(userId, mountainId, 11, 0)
        );
        return response(SuccessResponse.ok(preview));
    }

    @GetMapping("/courses/{courseId}/preview")
    public ResponseEntity<SuccessResponse<CommunityReviewPreviewResponse>> coursePreview(
            @CurrentUserId Long userId, @Positive @PathVariable Long courseId
    ) {
        var preview = new CommunityReviewPreviewResponse(
                queryService.getCourseReviews(userId, courseId, THREE_REVIEWS),
                photoService.getCoursePhotos(userId, courseId, 11, 0)
        );
        return response(SuccessResponse.ok(preview));
    }

    @GetMapping("/mountains/{mountainId}/spots/{targetType}/{targetId}/preview")
    public ResponseEntity<SuccessResponse<CommunityReviewPreviewResponse>> spotPreview(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @PathVariable CommunitySpotTargetType targetType,
            @Positive @PathVariable Long targetId
    ) {
        var preview = new CommunityReviewPreviewResponse(
                queryService.getSpotReviews(userId, mountainId, targetType, targetId, THREE_REVIEWS),
                photoService.getSpotPhotos(userId, mountainId, targetType, targetId, 11, 0)
        );
        return response(SuccessResponse.ok(preview));
    }

    private static <T> ResponseEntity<SuccessResponse<T>> response(SuccessResponse<T> body) {
        return ResponseEntity.status(body.getHttpStatus()).body(body);
    }
}
