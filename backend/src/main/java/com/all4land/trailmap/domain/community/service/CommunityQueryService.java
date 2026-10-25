package com.all4land.trailmap.domain.community.service;

import com.all4land.trailmap.domain.community.dto.request.CommunityReviewPageRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotMapRequest;
import com.all4land.trailmap.domain.community.dto.response.CommunityReviewResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityCoordinateResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityCourseResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityMountainResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotDetailResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotResponse;
import com.all4land.trailmap.domain.community.entity.CommunityReviewKind;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.error.CommunityErrorCode;
import com.all4land.trailmap.domain.community.exception.CommunityException;
import com.all4land.trailmap.domain.community.repository.CommunityQueryRepository;
import com.all4land.trailmap.domain.community.repository.CommunityReviewQueryResult;
import com.all4land.trailmap.domain.community.repository.CommunitySpotQueryResult;
import com.all4land.trailmap.domain.community.repository.R2PhotoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.LinkedHashMap;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommunityQueryService {

    private final CommunityQueryRepository queryRepository;
    private final R2PhotoRepository r2PhotoRepository;

    public List<CommunityMountainResponse> getMountains(Long userId) {
        validateUser(userId);
        return queryRepository.findMountains().stream()
                .map(mountain -> new CommunityMountainResponse(
                        mountain.mountainId(),
                        mountain.externalId(),
                        mountain.name(),
                        mountain.longitude(),
                        mountain.latitude()
                ))
                .toList();
    }

    public List<CommunityCourseResponse> getCourses(Long userId, Long mountainId) {
        validateUser(userId);
        validateMountain(mountainId);
        var courses = new LinkedHashMap<Long, CourseBuilder>();
        queryRepository.findCoursePoints(mountainId).forEach(point -> courses
                .computeIfAbsent(point.courseId(), ignored -> new CourseBuilder(
                        point.courseId(), point.mountainId(), point.externalId(), point.name(),
                        point.distanceKm(), point.reviewCount()
                ))
                .coordinates().add(new CommunityCoordinateResponse(point.longitude(), point.latitude())));
        return courses.values().stream().map(CourseBuilder::toResponse).toList();
    }

    public List<CommunitySpotResponse> getSpots(
            Long userId,
            Long mountainId,
            CommunitySpotMapRequest request
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        return queryRepository.findSpots(userId, mountainId, request).stream()
                .map(this::toSpotResponse)
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
                .map(this::toSpotDetailResponse)
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

    private CommunitySpotResponse toSpotResponse(CommunitySpotQueryResult spot) {
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
                toReadUrl(spot.representativePhotoKey())
        );
    }

    private CommunitySpotDetailResponse toSpotDetailResponse(CommunitySpotQueryResult spot) {
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
                toReadUrl(spot.representativePhotoKey())
        );
    }

    private List<CommunityReviewResponse> toReviewResponses(
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
                        review.photoKeys().stream().map(r2PhotoRepository::createReadUrl).toList()
                ))
                .toList();
    }

    private String toReadUrl(String objectKey) {
        return objectKey == null ? null : r2PhotoRepository.createReadUrl(objectKey);
    }

    private record CourseBuilder(
            Long courseId,
            Long mountainId,
            String externalId,
            String name,
            double distanceKm,
            long reviewCount,
            List<CommunityCoordinateResponse> coordinates
    ) {
        private CourseBuilder(
                Long courseId,
                Long mountainId,
                String externalId,
                String name,
                double distanceKm,
                long reviewCount
        ) {
            this(courseId, mountainId, externalId, name, distanceKm, reviewCount, new java.util.ArrayList<>());
        }

        private CommunityCourseResponse toResponse() {
            return new CommunityCourseResponse(
                    courseId, mountainId, externalId, name, distanceKm, reviewCount, List.copyOf(coordinates)
            );
        }
    }
}
