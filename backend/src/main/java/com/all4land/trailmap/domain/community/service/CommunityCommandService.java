package com.all4land.trailmap.domain.community.service;

import com.all4land.trailmap.domain.community.dto.request.CommunityReviewCreateRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotCreateRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotDuplicateRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotVoteRequest;
import com.all4land.trailmap.domain.community.dto.response.CommunityReviewEligibilityResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityReviewResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotCreatedResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotDuplicateResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunitySpotVoteResponse;
import com.all4land.trailmap.domain.community.dto.response.EligibleHikeResponse;
import com.all4land.trailmap.domain.community.entity.CommunityReviewKind;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CourseReview;
import com.all4land.trailmap.domain.community.entity.MountainReview;
import com.all4land.trailmap.domain.community.entity.SpotReview;
import com.all4land.trailmap.domain.community.entity.SpotVote;
import com.all4land.trailmap.domain.community.entity.CommunityVoteType;
import com.all4land.trailmap.domain.community.error.CommunityErrorCode;
import com.all4land.trailmap.domain.community.exception.CommunityException;
import com.all4land.trailmap.domain.community.repository.map.CommunityMapQueryRepository;
import com.all4land.trailmap.domain.community.repository.result.CommunitySpotDuplicateQueryResult;
import com.all4land.trailmap.domain.community.repository.result.CommunityVoteTargetQueryResult;
import com.all4land.trailmap.domain.community.repository.result.EligibleHikeQueryResult;
import com.all4land.trailmap.domain.community.repository.review.CourseReviewRepository;
import com.all4land.trailmap.domain.community.repository.review.CommunityReviewQueryRepository;
import com.all4land.trailmap.domain.community.repository.review.MountainReviewRepository;
import com.all4land.trailmap.domain.community.repository.review.SpotReviewRepository;
import com.all4land.trailmap.domain.community.repository.spot.CommunitySpotCommandRepository;
import com.all4land.trailmap.domain.community.repository.spot.CommunitySpotQueryRepository;
import com.all4land.trailmap.domain.community.repository.spot.SpotVoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
public class CommunityCommandService {

    private static final Duration REVIEW_WINDOW = Duration.ofHours(24);
    private static final ZoneId SERVICE_ZONE = ZoneId.of("Asia/Seoul");

    private final CommunityMapQueryRepository mapQueryRepository;
    private final CommunityReviewQueryRepository reviewQueryRepository;
    private final CommunitySpotQueryRepository spotQueryRepository;
    private final CommunitySpotCommandRepository spotCommandRepository;
    private final MountainReviewRepository mountainReviewRepository;
    private final CourseReviewRepository courseReviewRepository;
    private final SpotReviewRepository spotReviewRepository;
    private final SpotVoteRepository spotVoteRepository;

    @Transactional(readOnly = true)
    public CommunityReviewEligibilityResponse getMountainReviewEligibility(Long userId, Long mountainId) {
        validateUser(userId);
        validateMountain(mountainId);
        return eligibility(userId, mountainId, null);
    }

    @Transactional(readOnly = true)
    public CommunityReviewEligibilityResponse getCourseReviewEligibility(Long userId, Long courseId) {
        validateUser(userId);
        Long mountainId = mapQueryRepository.findCourseMountainId(courseId)
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.COURSE_NOT_FOUND));
        return eligibility(userId, mountainId, courseId);
    }

    @Transactional(readOnly = true)
    public CommunityReviewEligibilityResponse getSpotReviewEligibility(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        validateUser(userId);
        validateSpot(userId, mountainId, targetType, targetId);
        return eligibility(userId, mountainId, null);
    }

    public CommunityReviewResponse createMountainReview(
            Long userId,
            Long mountainId,
            CommunityReviewCreateRequest request
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        if (request.rating() == null) {
            throw new CommunityException(CommunityErrorCode.INVALID_REVIEW_REQUEST);
        }
        EligibleHikeQueryResult hike = requireEligibleHike(userId, mountainId, null, request.hikeRecordId());
        MountainReview review = mountainReviewRepository.saveAndFlush(MountainReview.create(
                userId,
                mountainId,
                hike.hikeRecordId(),
                request.content().trim(),
                hike.endedAt().atZoneSameInstant(SERVICE_ZONE).toLocalDate(),
                request.rating()
        ));
        return reviewResponse(
                review.getReviewId(), CommunityReviewKind.MOUNTAIN, mountainId, hike.hikeRecordId(),
                userId, review.getContent(), review.getRating().doubleValue(), review.getVisitedDate(), review.getCreatedAt()
        );
    }

    public CommunityReviewResponse createCourseReview(
            Long userId,
            Long courseId,
            CommunityReviewCreateRequest request
    ) {
        validateRatingAbsent(request);
        validateUser(userId);
        Long mountainId = mapQueryRepository.findCourseMountainId(courseId)
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.COURSE_NOT_FOUND));
        EligibleHikeQueryResult hike = requireEligibleHike(userId, mountainId, courseId, request.hikeRecordId());
        CourseReview review = courseReviewRepository.saveAndFlush(CourseReview.create(
                userId,
                courseId,
                hike.hikeRecordId(),
                request.content().trim(),
                hike.endedAt().atZoneSameInstant(SERVICE_ZONE).toLocalDate()
        ));
        return reviewResponse(
                review.getReviewId(), CommunityReviewKind.COURSE, courseId, hike.hikeRecordId(),
                userId, review.getContent(), null, review.getVisitedDate(), review.getCreatedAt()
        );
    }

    public CommunityReviewResponse createSpotReview(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId,
            CommunityReviewCreateRequest request
    ) {
        validateRatingAbsent(request);
        validateUser(userId);
        validateSpot(userId, mountainId, targetType, targetId);
        EligibleHikeQueryResult hike = requireEligibleHike(userId, mountainId, null, request.hikeRecordId());
        SpotReview review = spotReviewRepository.saveAndFlush(SpotReview.create(
                userId,
                targetType,
                targetId,
                hike.hikeRecordId(),
                request.content().trim(),
                hike.endedAt().atZoneSameInstant(SERVICE_ZONE).toLocalDate()
        ));
        return reviewResponse(
                review.getReviewId(), CommunityReviewKind.SPOT, targetId, hike.hikeRecordId(),
                userId, review.getContent(), null, review.getVisitedDate(), review.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<CommunitySpotDuplicateResponse> findSpotDuplicates(
            Long userId,
            Long mountainId,
            CommunitySpotDuplicateRequest request
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        return spotCommandRepository.findDuplicates(
                mountainId, request.type(), request.longitude(), request.latitude()
        ).stream().map(CommunityCommandService::duplicateResponse).toList();
    }

    public CommunitySpotCreatedResponse createSpot(
            Long userId,
            Long mountainId,
            CommunitySpotCreateRequest request
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        requireEligibleHike(userId, mountainId, null, request.hikeRecordId());

        List<CommunitySpotDuplicateQueryResult> duplicates = spotCommandRepository.findDuplicates(
                mountainId, request.type(), request.longitude(), request.latitude()
        );
        if (!duplicates.isEmpty() && !request.confirmDistinct()) {
            throw new CommunityException(CommunityErrorCode.DUPLICATE_SPOT_CANDIDATE);
        }

        String name = request.name().trim();
        Long spotId = spotCommandRepository.insert(
                userId,
                mountainId,
                request.hikeRecordId(),
                request.type(),
                name,
                request.longitude(),
                request.latitude()
        );
        return new CommunitySpotCreatedResponse(
                spotId,
                mountainId,
                name,
                request.type(),
                request.longitude(),
                request.latitude(),
                "PENDING"
        );
    }

    public CommunitySpotVoteResponse castSpotVote(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId,
            CommunitySpotVoteRequest request
    ) {
        CommunityVoteTargetQueryResult target = lockVoteTarget(userId, mountainId, targetType, targetId);
        SpotVote vote = findVote(userId, targetType, targetId)
                .orElseGet(() -> SpotVote.create(userId, targetType, targetId, request.voteType()));
        vote.change(request.voteType());
        spotVoteRepository.saveAndFlush(vote);
        return voteResponse(target, request.voteType());
    }

    public CommunitySpotVoteResponse cancelSpotVote(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        CommunityVoteTargetQueryResult target = lockVoteTarget(userId, mountainId, targetType, targetId);
        findVote(userId, targetType, targetId).ifPresent(vote -> {
            spotVoteRepository.delete(vote);
            spotVoteRepository.flush();
        });
        return voteResponse(target, null);
    }

    private CommunityReviewEligibilityResponse eligibility(Long userId, Long mountainId, Long courseId) {
        OffsetDateTime now = OffsetDateTime.now(SERVICE_ZONE);
        List<EligibleHikeResponse> hikes = reviewQueryRepository.findEligibleHikes(
                userId, mountainId, courseId, now.minus(REVIEW_WINDOW), now
        ).stream().map(CommunityCommandService::eligibleHikeResponse).toList();
        return new CommunityReviewEligibilityResponse(hikes);
    }

    private CommunityVoteTargetQueryResult lockVoteTarget(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        return spotCommandRepository.lockVoteTarget(mountainId, targetType, targetId)
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.SPOT_NOT_FOUND));
    }

    private Optional<SpotVote> findVote(
            Long userId,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        return switch (targetType) {
            case FACILITY -> spotVoteRepository.findByUserIdAndFacilityId(userId, targetId);
            case USER_SPOT -> spotVoteRepository.findByUserIdAndSpotId(userId, targetId);
        };
    }

    private CommunitySpotVoteResponse voteResponse(
            CommunityVoteTargetQueryResult target,
            CommunityVoteType viewerVote
    ) {
        long yesVotes;
        long noVotes;
        String status = target.status();
        if (target.targetType() == CommunitySpotTargetType.FACILITY) {
            yesVotes = spotVoteRepository.countByFacilityIdAndVoteType(target.targetId(), CommunityVoteType.YES);
            noVotes = spotVoteRepository.countByFacilityIdAndVoteType(target.targetId(), CommunityVoteType.NO);
        } else {
            yesVotes = spotVoteRepository.countBySpotIdAndVoteType(target.targetId(), CommunityVoteType.YES);
            noVotes = spotVoteRepository.countBySpotIdAndVoteType(target.targetId(), CommunityVoteType.NO);
            status = spotCommandRepository.updateUserSpotVisibility(target.targetId(), noVotes);
        }
        return new CommunitySpotVoteResponse(
                target.targetType(),
                target.targetId(),
                yesVotes,
                noVotes,
                viewerVote,
                status
        );
    }

    private EligibleHikeQueryResult requireEligibleHike(
            Long userId,
            Long mountainId,
            Long courseId,
            Long hikeRecordId
    ) {
        OffsetDateTime now = OffsetDateTime.now(SERVICE_ZONE);
        return reviewQueryRepository.findEligibleHikes(
                        userId, mountainId, courseId, now.minus(REVIEW_WINDOW), now
                ).stream()
                .filter(hike -> hike.hikeRecordId().equals(hikeRecordId))
                .findFirst()
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.REVIEW_NOT_ELIGIBLE));
    }

    private CommunityReviewResponse reviewResponse(
            Long reviewId,
            CommunityReviewKind kind,
            Long targetId,
            Long hikeRecordId,
            Long userId,
            String content,
            Double rating,
            java.time.LocalDate visitedDate,
            LocalDateTime createdAt
    ) {
        String author = reviewQueryRepository.findUserDisplayName(userId)
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.USER_NOT_FOUND));
        return new CommunityReviewResponse(
                reviewId,
                kind,
                targetId,
                hikeRecordId,
                author,
                content,
                rating,
                visitedDate,
                createdAt.atZone(SERVICE_ZONE).toOffsetDateTime(),
                List.of()
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

    private void validateSpot(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        validateMountain(mountainId);
        if (spotQueryRepository.findSpot(userId, mountainId, targetType, targetId).isEmpty()) {
            throw new CommunityException(CommunityErrorCode.SPOT_NOT_FOUND);
        }
    }

    private static void validateRatingAbsent(CommunityReviewCreateRequest request) {
        if (request.rating() != null) {
            throw new CommunityException(CommunityErrorCode.INVALID_REVIEW_REQUEST);
        }
    }

    private static EligibleHikeResponse eligibleHikeResponse(EligibleHikeQueryResult hike) {
        return new EligibleHikeResponse(
                hike.hikeRecordId(), hike.courseId(), hike.courseName(), hike.endedAt()
        );
    }

    private static CommunitySpotDuplicateResponse duplicateResponse(CommunitySpotDuplicateQueryResult spot) {
        return new CommunitySpotDuplicateResponse(
                spot.targetType(),
                spot.targetId(),
                spot.name(),
                spot.type(),
                spot.longitude(),
                spot.latitude(),
                spot.distanceMeters(),
                spot.status()
        );
    }
}
