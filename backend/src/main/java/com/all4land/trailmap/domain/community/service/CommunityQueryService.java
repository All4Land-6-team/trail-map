package com.all4land.trailmap.domain.community.service;

import com.all4land.trailmap.domain.community.dto.request.CommunityReviewPageRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotMapRequest;
import com.all4land.trailmap.domain.community.dto.response.CommunityReviewResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotDetailResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotResponse;
import com.all4land.trailmap.domain.community.entity.CommunityReviewKind;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.error.CommunityErrorCode;
import com.all4land.trailmap.domain.community.exception.CommunityException;
import com.all4land.trailmap.domain.community.repository.CommunityQueryRepository;
import com.all4land.trailmap.domain.community.repository.CommunityReviewQueryResult;
import com.all4land.trailmap.domain.community.repository.CommunitySpotQueryResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommunityQueryService {

    private final CommunityQueryRepository queryRepository;

    public List<CommunitySpotResponse> getSpots(
            Long userId,
            Long mountainId,
            CommunitySpotMapRequest request
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        return queryRepository.findSpots(userId, mountainId, request).stream()
                .map(CommunityQueryService::toSpotResponse)
                .toList();
    }

    public CommunitySpotDetailResponse getSpot(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        return queryRepository.findSpot(userId, mountainId, targetType, targetId)
                .map(CommunityQueryService::toSpotDetailResponse)
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.SPOT_NOT_FOUND));
    }

    public List<CommunityReviewResponse> getMountainReviews(
            Long userId,
            Long mountainId,
            CommunityReviewPageRequest page
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        return toReviewResponses(
                queryRepository.findMountainReviews(mountainId, page.resolvedLimit(), page.resolvedOffset()),
                CommunityReviewKind.MOUNTAIN
        );
    }

    public List<CommunityReviewResponse> getCourseReviews(
            Long userId,
            Long courseId,
            CommunityReviewPageRequest page
    ) {
        validateUser(userId);
        if (!queryRepository.existsCourse(courseId)) {
            throw new CommunityException(CommunityErrorCode.COURSE_NOT_FOUND);
        }
        return toReviewResponses(
                queryRepository.findCourseReviews(courseId, page.resolvedLimit(), page.resolvedOffset()),
                CommunityReviewKind.COURSE
        );
    }

    public List<CommunityReviewResponse> getSpotReviews(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId,
            CommunityReviewPageRequest page
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        if (queryRepository.findSpot(userId, mountainId, targetType, targetId).isEmpty()) {
            throw new CommunityException(CommunityErrorCode.SPOT_NOT_FOUND);
        }
        return toReviewResponses(
                queryRepository.findSpotReviews(targetType, targetId, page.resolvedLimit(), page.resolvedOffset()),
                CommunityReviewKind.SPOT
        );
    }

    private void validateUser(Long userId) {
        if (!queryRepository.existsUser(userId)) {
            throw new CommunityException(CommunityErrorCode.USER_NOT_FOUND);
        }
    }

    private void validateMountain(Long mountainId) {
        if (!queryRepository.existsMountain(mountainId)) {
            throw new CommunityException(CommunityErrorCode.MOUNTAIN_NOT_FOUND);
        }
    }

    private static CommunitySpotResponse toSpotResponse(CommunitySpotQueryResult spot) {
        return new CommunitySpotResponse(
                spot.targetType(),
                spot.targetId(),
                spot.mountainId(),
                spot.name(),
                spot.type(),
                spot.longitude(),
                spot.latitude(),
                spot.official(),
                spot.status(),
                spot.yesVotes(),
                spot.noVotes(),
                spot.viewerVote(),
                spot.reviewCount(),
                spot.photoCount(),
                spot.representativePhotoKey()
        );
    }

    private static CommunitySpotDetailResponse toSpotDetailResponse(CommunitySpotQueryResult spot) {
        return new CommunitySpotDetailResponse(
                spot.targetType(),
                spot.targetId(),
                spot.mountainId(),
                spot.name(),
                spot.type(),
                spot.longitude(),
                spot.latitude(),
                spot.official(),
                spot.status(),
                spot.sourceName(),
                spot.sourceUrl(),
                spot.yesVotes(),
                spot.noVotes(),
                spot.viewerVote(),
                spot.reviewCount(),
                spot.photoCount(),
                spot.representativePhotoKey()
        );
    }

    private static List<CommunityReviewResponse> toReviewResponses(
            List<CommunityReviewQueryResult> reviews,
            CommunityReviewKind kind
    ) {
        return reviews.stream()
                .map(review -> new CommunityReviewResponse(
                        review.reviewId(),
                        kind,
                        review.targetId(),
                        review.hikeRecordId(),
                        review.author(),
                        review.content(),
                        review.rating(),
                        review.visitedDate(),
                        review.createdAt(),
                        review.photoKeys()
                ))
                .toList();
    }
}
