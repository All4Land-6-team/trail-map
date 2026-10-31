package com.all4land.trailmap.domain.community.service;

import com.all4land.trailmap.domain.community.dto.request.CommunityReviewPageRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotMapRequest;
import com.all4land.trailmap.domain.community.dto.response.CommunityReviewResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityCoordinateResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityCourseResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityMountainResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotDetailResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotPageResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotMapResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityMountainReviewSummaryResponse;
import com.all4land.trailmap.domain.community.entity.CommunityReviewKind;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CommunitySpotType;
import com.all4land.trailmap.domain.community.error.CommunityErrorCode;
import com.all4land.trailmap.domain.community.exception.CommunityException;
import com.all4land.trailmap.domain.community.repository.map.CommunityMapQueryRepository;
import com.all4land.trailmap.domain.community.repository.result.CommunityReviewQueryResult;
import com.all4land.trailmap.domain.community.repository.result.CommunitySpotQueryResult;
import com.all4land.trailmap.domain.community.repository.review.CommunityReviewQueryRepository;
import com.all4land.trailmap.domain.community.repository.spot.CommunitySpotQueryRepository;
import com.all4land.trailmap.domain.community.storage.R2PhotoStorage;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Base64;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommunityQueryService {

    private final CommunityMapQueryRepository mapQueryRepository;
    private final CommunityReviewQueryRepository reviewQueryRepository;
    private final CommunitySpotQueryRepository spotQueryRepository;
    private final R2PhotoStorage r2PhotoStorage;
    private final ObjectMapper objectMapper;

    public List<CommunityMountainResponse> getMountains(Long userId) {
        validateUser(userId);
        return mapQueryRepository.findMountains().stream()
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
        return mapQueryRepository.findCourses(mountainId).stream()
                .map(course -> new CommunityCourseResponse(
                        course.courseId(),
                        course.mountainId(),
                        course.externalId(),
                        course.name(),
                        course.distanceKm(),
                        course.reviewCount(),
                        course.photoCount(),
                        toReadUrl(course.representativePhotoKey()),
                        parseRouteCoordinates(course.routeGeoJson())
                ))
                .toList();
    }

    public List<CommunitySpotResponse> getSpots(
            Long userId,
            Long mountainId,
            CommunitySpotMapRequest request
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        return spotQueryRepository.findSpots(userId, mountainId, request).stream()
                .map(this::toSpotResponse)
                .toList();
    }

    public List<CommunitySpotMapResponse> getMapMarkers(Long userId, Long mountainId, CommunitySpotMapRequest request) {
        validateUser(userId);
        validateMountain(mountainId);
        return spotQueryRepository.findMapMarkers(userId, mountainId, request);
    }

    public CommunitySpotPageResponse getSpotPage(Long userId, Long mountainId, CommunitySpotType type, int size, String cursor) {
        validateUser(userId);
        validateMountain(mountainId);
        if (size < 1 || size > 20) throw new CommunityException(CommunityErrorCode.INVALID_SPOT_CURSOR);
        OffsetDateTime afterReviewAt = null;
        String afterType = null;
        Long afterId = null;
        if (cursor != null) {
            try {
                var parts = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8).split("\\|", -1);
                if (parts.length != 5 || !parts[0].equals(String.valueOf(mountainId))
                        || !parts[1].equals(type == null ? "ALL" : type.name())
                        || !(parts[3].equals("FACILITY") || parts[3].equals("USER_SPOT"))) {
                    throw new IllegalArgumentException();
                }
                if (!parts[2].equals("NONE")) {
                    afterReviewAt = OffsetDateTime.ofInstant(Instant.ofEpochMilli(Long.parseLong(parts[2])), ZoneOffset.UTC);
                }
                afterType = parts[3];
                afterId = Long.parseLong(parts[4]);
                if (afterId <= 0) throw new IllegalArgumentException();
            } catch (IllegalArgumentException error) {
                throw new CommunityException(CommunityErrorCode.INVALID_SPOT_CURSOR);
            }
        }
        var found = spotQueryRepository.findSpotPage(userId, mountainId, type, afterReviewAt, afterType, afterId, size + 1);
        var items = found.stream().limit(size).map(this::toSpotResponse).toList();
        var last = found.size() > size ? found.get(size - 1) : null;
        var next = last == null ? null : Base64.getUrlEncoder().withoutPadding().encodeToString(
                (mountainId + "|" + (type == null ? "ALL" : type.name()) + "|"
                        + (last.latestReviewAt() == null ? "NONE" : last.latestReviewAt().toInstant().toEpochMilli()) + "|"
                        + last.targetType().name() + "|" + last.targetId())
                        .getBytes(StandardCharsets.UTF_8));
        return new CommunitySpotPageResponse(items, next, last != null);
    }

    public CommunitySpotDetailResponse getSpot(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        return spotQueryRepository.findSpot(userId, mountainId, targetType, targetId)
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
                reviewQueryRepository.findMountainReviews(mountainId, page.resolvedLimit(), page.resolvedOffset()),
                CommunityReviewKind.MOUNTAIN
        );
    }

    public CommunityMountainReviewSummaryResponse getMountainReviewSummary(Long userId, Long mountainId) {
        validateUser(userId);
        validateMountain(mountainId);
        return reviewQueryRepository.findMountainReviewSummary(mountainId);
    }

    public List<CommunityReviewResponse> getCourseReviews(
            Long userId,
            Long courseId,
            CommunityReviewPageRequest page
    ) {
        validateUser(userId);
        if (!mapQueryRepository.existsCourse(courseId)) {
            throw new CommunityException(CommunityErrorCode.COURSE_NOT_FOUND);
        }
        return toReviewResponses(
                reviewQueryRepository.findCourseReviews(courseId, page.resolvedLimit(), page.resolvedOffset()),
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
        if (spotQueryRepository.findSpot(userId, mountainId, targetType, targetId).isEmpty()) {
            throw new CommunityException(CommunityErrorCode.SPOT_NOT_FOUND);
        }
        return toReviewResponses(
                reviewQueryRepository.findSpotReviews(targetType, targetId, page.resolvedLimit(), page.resolvedOffset()),
                CommunityReviewKind.SPOT
        );
    }

    private void validateUser(Long userId) {
        if (!reviewQueryRepository.existsUser(userId)) {
            throw new CommunityException(CommunityErrorCode.USER_NOT_FOUND);
        }
    }

    private void validateMountain(Long mountainId) {
        if (!mapQueryRepository.existsMountain(mountainId)) {
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
                        review.photoKeys().stream().map(r2PhotoStorage::createReadUrl).toList()
                ))
                .toList();
    }

    private String toReadUrl(String objectKey) {
        return objectKey == null ? null : r2PhotoStorage.createReadUrl(objectKey);
    }

    private List<CommunityCoordinateResponse> parseRouteCoordinates(String routeGeoJson) {
        try {
            var coordinates = objectMapper.readTree(routeGeoJson).path("coordinates");
            if (!coordinates.isArray()) {
                throw new IllegalStateException("코스 경로 좌표가 배열이 아닙니다.");
            }
            var result = new java.util.ArrayList<CommunityCoordinateResponse>(coordinates.size());
            for (var coordinate : coordinates) {
                if (!coordinate.isArray() || coordinate.size() < 2) {
                    throw new IllegalStateException("코스 경로 좌표가 올바르지 않습니다.");
                }
                result.add(new CommunityCoordinateResponse(coordinate.get(0).asDouble(), coordinate.get(1).asDouble()));
            }
            return List.copyOf(result);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("코스 경로 GeoJSON을 읽지 못했습니다.", error);
        }
    }
}
