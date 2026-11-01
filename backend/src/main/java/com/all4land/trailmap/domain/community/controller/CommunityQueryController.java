package com.all4land.trailmap.domain.community.controller;

import com.all4land.trailmap.domain.community.dto.request.CommunityReviewPageRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotMapRequest;
import com.all4land.trailmap.domain.community.dto.response.CommunityReviewResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityCourseResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityMountainResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotDetailResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotPageResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotMapResponse;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CommunitySpotType;
import com.all4land.trailmap.domain.community.service.CommunityQueryService;
import com.all4land.trailmap.global.response.SuccessResponse;
import com.all4land.trailmap.global.user.CurrentUserId;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/v1/community")
@RequiredArgsConstructor
public class CommunityQueryController {

    private final CommunityQueryService queryService;

    @GetMapping("/mountains")
    public ResponseEntity<SuccessResponse<List<CommunityMountainResponse>>> getMountains(
            @CurrentUserId Long userId
    ) {
        return response(SuccessResponse.ok(queryService.getMountains(userId)));
    }

    @GetMapping("/mountains/{mountainId}/courses")
    public ResponseEntity<SuccessResponse<List<CommunityCourseResponse>>> getCourses(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId
    ) {
        return response(SuccessResponse.ok(queryService.getCourses(userId, mountainId)));
    }

    @GetMapping("/mountains/{mountainId}/spots")
    public ResponseEntity<SuccessResponse<List<CommunitySpotResponse>>> getSpots(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @Valid @ModelAttribute CommunitySpotMapRequest request
    ) {
        return response(SuccessResponse.ok(queryService.getSpots(userId, mountainId, request)));
    }

    @GetMapping("/mountains/{mountainId}/spots/map")
    public ResponseEntity<SuccessResponse<List<CommunitySpotMapResponse>>> getMapMarkers(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @Valid @ModelAttribute CommunitySpotMapRequest request
    ) {
        return response(SuccessResponse.ok(queryService.getMapMarkers(userId, mountainId, request)));
    }

    @GetMapping("/mountains/{mountainId}/spots/list")
    public ResponseEntity<SuccessResponse<CommunitySpotPageResponse>> getSpotPage(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @RequestParam(required = false) CommunitySpotType type,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String cursor
    ) {
        return response(SuccessResponse.ok(queryService.getSpotPage(userId, mountainId, type, size, cursor)));
    }

    @GetMapping("/mountains/{mountainId}/spots/{targetType}/{targetId}")
    public ResponseEntity<SuccessResponse<CommunitySpotDetailResponse>> getSpot(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @PathVariable CommunitySpotTargetType targetType,
            @Positive @PathVariable Long targetId
    ) {
        return response(SuccessResponse.ok(queryService.getSpot(userId, mountainId, targetType, targetId)));
    }

    @GetMapping("/mountains/{mountainId}/reviews")
    public ResponseEntity<SuccessResponse<List<CommunityReviewResponse>>> getMountainReviews(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @Valid @ModelAttribute CommunityReviewPageRequest page
    ) {
        return response(SuccessResponse.ok(queryService.getMountainReviews(userId, mountainId, page)));
    }

    @GetMapping("/courses/{courseId}/reviews")
    public ResponseEntity<SuccessResponse<List<CommunityReviewResponse>>> getCourseReviews(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long courseId,
            @Valid @ModelAttribute CommunityReviewPageRequest page
    ) {
        return response(SuccessResponse.ok(queryService.getCourseReviews(userId, courseId, page)));
    }

    @GetMapping("/mountains/{mountainId}/spots/{targetType}/{targetId}/reviews")
    public ResponseEntity<SuccessResponse<List<CommunityReviewResponse>>> getSpotReviews(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @PathVariable CommunitySpotTargetType targetType,
            @Positive @PathVariable Long targetId,
            @Valid @ModelAttribute CommunityReviewPageRequest page
    ) {
        return response(SuccessResponse.ok(
                queryService.getSpotReviews(userId, mountainId, targetType, targetId, page)
        ));
    }

    private static <T> ResponseEntity<SuccessResponse<T>> response(SuccessResponse<T> body) {
        return ResponseEntity.status(body.getHttpStatus()).body(body);
    }
}
