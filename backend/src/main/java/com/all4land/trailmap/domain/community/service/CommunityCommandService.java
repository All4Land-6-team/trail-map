package com.all4land.trailmap.domain.community.service;

import com.all4land.trailmap.domain.community.dto.request.CommunityReviewCreateRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotCreateRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotDuplicateRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunitySpotVoteRequest;
import com.all4land.trailmap.domain.community.dto.response.CommunityReviewEligibilityCode;
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
import com.all4land.trailmap.domain.community.repository.result.CreatedUserSpotQueryResult;
import com.all4land.trailmap.domain.community.repository.review.CourseReviewRepository;
import com.all4land.trailmap.domain.community.repository.review.CommunityReviewQueryRepository;
import com.all4land.trailmap.domain.community.repository.review.MountainReviewRepository;
import com.all4land.trailmap.domain.community.repository.review.SpotReviewRepository;
import com.all4land.trailmap.domain.community.repository.spot.CommunitySpotCommandRepository;
import com.all4land.trailmap.domain.community.repository.spot.CommunitySpotQueryRepository;
import com.all4land.trailmap.domain.community.repository.spot.SpotVoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.SQLException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

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
    public CommunityReviewEligibilityResponse getEligibleHikes(Long userId, Long mountainId) {
        validateUser(userId);
        validateMountain(mountainId);
        OffsetDateTime now = OffsetDateTime.now(SERVICE_ZONE);
        List<EligibleHikeResponse> hikes = reviewQueryRepository.findEligibleHikes(
                userId, mountainId, null, now.minus(REVIEW_WINDOW), now
        ).stream().map(CommunityCommandService::eligibleHikeResponse).toList();
        return hikes.isEmpty()
                ? notEligible(CommunityReviewEligibilityCode.NO_COMPLETED_HIKE,
                        "산행 완료 후 24시간 이내에만 작성할 수 있어요.")
                : eligible(hikes);
    }

    @Transactional(readOnly = true)
    public CommunityReviewEligibilityResponse getMountainReviewEligibility(Long userId, Long mountainId) {
        validateUser(userId);
        validateMountain(mountainId);
        return eligibility(userId, mountainId, null, CommunityReviewKind.MOUNTAIN, null, mountainId);
    }

    @Transactional(readOnly = true)
    public CommunityReviewEligibilityResponse getCourseReviewEligibility(Long userId, Long courseId) {
        validateUser(userId);
        Long mountainId = mapQueryRepository.findCourseMountainId(courseId)
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.COURSE_NOT_FOUND));
        return eligibility(userId, mountainId, courseId, CommunityReviewKind.COURSE, null, courseId);
    }

    @Transactional(readOnly = true)
    public CommunityReviewEligibilityResponse getSpotReviewEligibility(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId,
            Long hikeRecordId
    ) {
        validateUser(userId);
        validateSpot(userId, mountainId, targetType, targetId);
        if (hikeRecordId != null) {
            EligibleHikeQueryResult hike = requireSpotReviewEligibleHike(
                    userId, mountainId, hikeRecordId, targetType, targetId
            );
            return eligible(List.of(eligibleHikeResponse(hike)));
        }
        return eligibility(userId, mountainId, null, CommunityReviewKind.SPOT, targetType, targetId);
    }

    public CommunityReviewResponse createMountainReview(
            Long userId,
            Long mountainId,
            CommunityReviewCreateRequest request
    ) {
        validateUser(userId);
        validateMountain(mountainId);
        validateRatingAbsent(request);
        EligibleHikeQueryResult hike = requireReviewEligibleHike(
                userId, mountainId, null, request.hikeRecordId(), CommunityReviewKind.MOUNTAIN, null, mountainId
        );
        MountainReview review = saveReview(() -> mountainReviewRepository.saveAndFlush(MountainReview.create(
                userId,
                mountainId,
                hike.hikeRecordId(),
                request.content().trim(),
                hike.endedAt().atZoneSameInstant(SERVICE_ZONE).toLocalDate()
        )));
        return reviewResponse(
                review.getReviewId(), CommunityReviewKind.MOUNTAIN, mountainId, hike.hikeRecordId(),
                userId, review.getContent(), null, review.getVisitedDate(), review.getCreatedAt()
        );
    }

    public CommunityReviewResponse createCourseReview(
            Long userId,
            Long courseId,
            CommunityReviewCreateRequest request
    ) {
        validateRatingPresent(request);
        validateUser(userId);
        Long mountainId = mapQueryRepository.findCourseMountainId(courseId)
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.COURSE_NOT_FOUND));
        EligibleHikeQueryResult hike = requireReviewEligibleHike(
                userId, mountainId, courseId, request.hikeRecordId(), CommunityReviewKind.COURSE, null, courseId
        );
        CourseReview review = saveReview(() -> courseReviewRepository.saveAndFlush(CourseReview.create(
                userId,
                courseId,
                hike.hikeRecordId(),
                request.content().trim(),
                hike.endedAt().atZoneSameInstant(SERVICE_ZONE).toLocalDate(),
                request.rating()
        )));
        return reviewResponse(
                review.getReviewId(), CommunityReviewKind.COURSE, courseId, hike.hikeRecordId(),
                userId, review.getContent(), review.getRating().doubleValue(), review.getVisitedDate(), review.getCreatedAt()
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
        EligibleHikeQueryResult hike = requireSpotReviewEligibleHike(
                userId, mountainId, request.hikeRecordId(), targetType, targetId
        );
        SpotReview review = saveReview(() -> spotReviewRepository.saveAndFlush(SpotReview.create(
                userId,
                targetType,
                targetId,
                hike.hikeRecordId(),
                request.content().trim(),
                hike.endedAt().atZoneSameInstant(SERVICE_ZONE).toLocalDate()
        )));
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
        var existing = spotCommandRepository.findByClientRequestId(userId, request.clientRequestId());
        if (existing.isPresent()) {
            return createdSpotResponse(userId, existing.get());
        }
        EligibleHikeQueryResult hike = requireSpotEligibleHike(userId, mountainId, request.hikeRecordId());

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
                request.latitude(),
                request.clientRequestId()
        ).orElseGet(() -> spotCommandRepository.findByClientRequestId(userId, request.clientRequestId())
                .map(CreatedUserSpotQueryResult::spotId)
                .orElseThrow(() -> new IllegalStateException("스팟 등록 결과를 찾지 못했습니다.")));
        var existingReview = spotReviewRepository.findByHikeRecordIdAndSpotIdAndDeletedAtIsNull(hike.hikeRecordId(), spotId);
        if (existingReview.isPresent()) {
            return createdSpotResponse(userId, spotCommandRepository.findByClientRequestId(userId, request.clientRequestId())
                    .orElseThrow(() -> new IllegalStateException("스팟 등록 결과를 찾지 못했습니다.")));
        }
        SpotReview review = saveReview(() -> spotReviewRepository.saveAndFlush(SpotReview.create(
                userId,
                CommunitySpotTargetType.USER_SPOT,
                spotId,
                hike.hikeRecordId(),
                request.reviewContent().trim(),
                hike.endedAt().atZoneSameInstant(SERVICE_ZONE).toLocalDate()
        )));
        CommunityReviewResponse reviewResponse = reviewResponse(
                review.getReviewId(), CommunityReviewKind.SPOT, spotId, hike.hikeRecordId(), userId,
                review.getContent(), null, review.getVisitedDate(), review.getCreatedAt()
        );
        return new CommunitySpotCreatedResponse(
                spotId,
                mountainId,
                name,
                request.type(),
                request.longitude(),
                request.latitude(),
                "PENDING",
                reviewResponse
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

    private CommunityReviewEligibilityResponse eligibility(
            Long userId,
            Long mountainId,
            Long courseId,
            CommunityReviewKind kind,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        OffsetDateTime now = OffsetDateTime.now(SERVICE_ZONE);
        List<EligibleHikeQueryResult> completedHikes = reviewQueryRepository.findEligibleHikes(
                userId, mountainId, courseId, now.minus(REVIEW_WINDOW), now
        );
        if (completedHikes.isEmpty()) {
            return notEligible(CommunityReviewEligibilityCode.NO_COMPLETED_HIKE,
                    "산행 완료 후 24시간 이내에만 작성할 수 있어요.");
        }
        List<EligibleHikeResponse> hikes = completedHikes.stream()
                .filter(hike -> !reviewExists(kind, targetType, targetId, hike.hikeRecordId()))
                .map(CommunityCommandService::eligibleHikeResponse)
                .toList();
        if (hikes.isEmpty()) {
            String targetName = switch (kind) {
                case MOUNTAIN -> "산";
                case COURSE -> "코스";
                case SPOT -> "스팟";
            };
            return notEligible(CommunityReviewEligibilityCode.ALREADY_REVIEWED,
                    "오늘 산행에서 해당 " + targetName + " 후기를 이미 작성했어요.");
        }
        return eligible(hikes);
    }

    private static CommunityReviewEligibilityResponse eligible(List<EligibleHikeResponse> hikes) {
        return new CommunityReviewEligibilityResponse(CommunityReviewEligibilityCode.ELIGIBLE, null, hikes);
    }

    private static CommunityReviewEligibilityResponse notEligible(
            CommunityReviewEligibilityCode code,
            String reason
    ) {
        return new CommunityReviewEligibilityResponse(code, reason, List.of());
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

    private EligibleHikeQueryResult requireReviewEligibleHike(
            Long userId,
            Long mountainId,
            Long courseId,
            Long hikeRecordId,
            CommunityReviewKind kind,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        EligibleHikeQueryResult hike = requireEligibleHike(userId, mountainId, courseId, hikeRecordId);
        if (reviewExists(kind, targetType, targetId, hikeRecordId)) {
            throw new CommunityException(CommunityErrorCode.DUPLICATE_REVIEW);
        }
        return hike;
    }

    private EligibleHikeQueryResult requireSpotEligibleHike(Long userId, Long mountainId, Long hikeRecordId) {
        OffsetDateTime now = OffsetDateTime.now(SERVICE_ZONE);
        return reviewQueryRepository.findSpotEligibleHike(
                        userId, mountainId, hikeRecordId, now.minus(REVIEW_WINDOW), now
                )
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.REVIEW_NOT_ELIGIBLE));
    }

    private EligibleHikeQueryResult requireSpotReviewEligibleHike(
            Long userId,
            Long mountainId,
            Long hikeRecordId,
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        EligibleHikeQueryResult hike = requireSpotEligibleHike(userId, mountainId, hikeRecordId);
        if (reviewExists(CommunityReviewKind.SPOT, targetType, targetId, hikeRecordId)) {
            throw new CommunityException(CommunityErrorCode.DUPLICATE_REVIEW);
        }
        return hike;
    }

    private boolean reviewExists(
            CommunityReviewKind kind,
            CommunitySpotTargetType targetType,
            Long targetId,
            Long hikeRecordId
    ) {
        return switch (kind) {
            case MOUNTAIN -> mountainReviewRepository
                    .existsByHikeRecordIdAndMountainIdAndDeletedAtIsNull(hikeRecordId, targetId);
            case COURSE -> courseReviewRepository
                    .existsByHikeRecordIdAndCourseIdAndDeletedAtIsNull(hikeRecordId, targetId);
            case SPOT -> targetType == CommunitySpotTargetType.FACILITY
                    ? spotReviewRepository.existsByHikeRecordIdAndFacilityIdAndDeletedAtIsNull(hikeRecordId, targetId)
                    : spotReviewRepository.existsByHikeRecordIdAndSpotIdAndDeletedAtIsNull(hikeRecordId, targetId);
        };
    }

    private <T> T saveReview(Supplier<T> save) {
        try {
            return save.get();
        } catch (DataIntegrityViolationException error) {
            if (hasSqlState(error, "23505")) {
                throw new CommunityException(CommunityErrorCode.DUPLICATE_REVIEW);
            }
            throw error;
        }
    }

    private boolean hasSqlState(Throwable error, String sqlState) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sqlError && sqlState.equals(sqlError.getSQLState())) {
                return true;
            }
        }
        return false;
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

    private CommunitySpotCreatedResponse createdSpotResponse(Long userId, CreatedUserSpotQueryResult spot) {
        SpotReview review = spotReviewRepository
                .findByHikeRecordIdAndSpotIdAndDeletedAtIsNull(spot.hikeRecordId(), spot.spotId())
                .orElseThrow(() -> new IllegalStateException("스팟 후기 등록 결과를 찾지 못했습니다."));
        return new CommunitySpotCreatedResponse(
                spot.spotId(), spot.mountainId(), spot.name(), spot.type(), spot.longitude(), spot.latitude(), spot.status(),
                reviewResponse(review.getReviewId(), CommunityReviewKind.SPOT, spot.spotId(), spot.hikeRecordId(), userId,
                        review.getContent(), null, review.getVisitedDate(), review.getCreatedAt())
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

    private static void validateRatingPresent(CommunityReviewCreateRequest request) {
        if (request.rating() == null) {
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
