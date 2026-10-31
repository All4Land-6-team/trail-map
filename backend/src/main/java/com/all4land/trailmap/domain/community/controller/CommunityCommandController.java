package com.all4land.trailmap.domain.community.controller;

import com.all4land.trailmap.domain.community.dto.request.CommunityReviewCreateRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotCreateRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotDuplicateRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotVoteRequest;
import com.all4land.trailmap.domain.community.dto.response.CommunityReviewEligibilityResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityReviewResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotCreatedResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotDuplicateResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotVoteResponse;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.service.CommunityCommandService;
import com.all4land.trailmap.global.response.SuccessResponse;
import com.all4land.trailmap.global.user.CurrentUserId;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/v1/community")
@RequiredArgsConstructor
public class CommunityCommandController {

    private final CommunityCommandService commandService;

    @GetMapping("/mountains/{mountainId}/eligible-hikes")
    public ResponseEntity<SuccessResponse<CommunityReviewEligibilityResponse>> getEligibleHikes(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId
    ) {
        return response(SuccessResponse.ok(commandService.getEligibleHikes(userId, mountainId)));
    }

    @GetMapping("/mountains/{mountainId}/review-eligibility")
    public ResponseEntity<SuccessResponse<CommunityReviewEligibilityResponse>> getMountainReviewEligibility(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId
    ) {
        return response(SuccessResponse.ok(commandService.getMountainReviewEligibility(userId, mountainId)));
    }

    @GetMapping("/courses/{courseId}/review-eligibility")
    public ResponseEntity<SuccessResponse<CommunityReviewEligibilityResponse>> getCourseReviewEligibility(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long courseId
    ) {
        return response(SuccessResponse.ok(commandService.getCourseReviewEligibility(userId, courseId)));
    }

    @GetMapping("/mountains/{mountainId}/spots/{targetType}/{targetId}/review-eligibility")
    public ResponseEntity<SuccessResponse<CommunityReviewEligibilityResponse>> getSpotReviewEligibility(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @PathVariable CommunitySpotTargetType targetType,
            @Positive @PathVariable Long targetId
    ) {
        return response(SuccessResponse.ok(
                commandService.getSpotReviewEligibility(userId, mountainId, targetType, targetId)
        ));
    }

    @PostMapping("/mountains/{mountainId}/reviews")
    public ResponseEntity<SuccessResponse<CommunityReviewResponse>> createMountainReview(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @Valid @RequestBody CommunityReviewCreateRequest request
    ) {
        return response(SuccessResponse.created(commandService.createMountainReview(userId, mountainId, request)));
    }

    @PostMapping("/courses/{courseId}/reviews")
    public ResponseEntity<SuccessResponse<CommunityReviewResponse>> createCourseReview(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long courseId,
            @Valid @RequestBody CommunityReviewCreateRequest request
    ) {
        return response(SuccessResponse.created(commandService.createCourseReview(userId, courseId, request)));
    }

    @PostMapping("/mountains/{mountainId}/spots/{targetType}/{targetId}/reviews")
    public ResponseEntity<SuccessResponse<CommunityReviewResponse>> createSpotReview(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @PathVariable CommunitySpotTargetType targetType,
            @Positive @PathVariable Long targetId,
            @Valid @RequestBody CommunityReviewCreateRequest request
    ) {
        return response(SuccessResponse.created(
                commandService.createSpotReview(userId, mountainId, targetType, targetId, request)
        ));
    }

    @GetMapping("/mountains/{mountainId}/spots/duplicates")
    public ResponseEntity<SuccessResponse<List<CommunitySpotDuplicateResponse>>> findSpotDuplicates(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @Valid @ModelAttribute CommunitySpotDuplicateRequest request
    ) {
        return response(SuccessResponse.ok(commandService.findSpotDuplicates(userId, mountainId, request)));
    }

    @PostMapping("/mountains/{mountainId}/spots")
    public ResponseEntity<SuccessResponse<CommunitySpotCreatedResponse>> createSpot(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @Valid @RequestBody CommunitySpotCreateRequest request
    ) {
        return response(SuccessResponse.created(commandService.createSpot(userId, mountainId, request)));
    }

    @PutMapping("/mountains/{mountainId}/spots/{targetType}/{targetId}/vote")
    public ResponseEntity<SuccessResponse<CommunitySpotVoteResponse>> castSpotVote(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @PathVariable CommunitySpotTargetType targetType,
            @Positive @PathVariable Long targetId,
            @Valid @RequestBody CommunitySpotVoteRequest request
    ) {
        return response(SuccessResponse.ok(
                commandService.castSpotVote(userId, mountainId, targetType, targetId, request)
        ));
    }

    @DeleteMapping("/mountains/{mountainId}/spots/{targetType}/{targetId}/vote")
    public ResponseEntity<SuccessResponse<CommunitySpotVoteResponse>> cancelSpotVote(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long mountainId,
            @PathVariable CommunitySpotTargetType targetType,
            @Positive @PathVariable Long targetId
    ) {
        return response(SuccessResponse.ok(
                commandService.cancelSpotVote(userId, mountainId, targetType, targetId)
        ));
    }

    private static <T> ResponseEntity<SuccessResponse<T>> response(SuccessResponse<T> body) {
        return ResponseEntity.status(body.getHttpStatus()).body(body);
    }
}
