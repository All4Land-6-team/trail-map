package com.all4land.trailmap.domain.community.service;

import com.all4land.trailmap.domain.community.dto.request.CommunityPhotoConfirmRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunityPhotoUploadUrlRequest;
import com.all4land.trailmap.domain.community.dto.response.CommunityPhotoResponse;
import com.all4land.trailmap.domain.community.dto.response.CommunityPhotoUploadUrlResponse;
import com.all4land.trailmap.domain.community.entity.CommunityPhotoTargetType;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.Photo;
import com.all4land.trailmap.domain.community.error.CommunityErrorCode;
import com.all4land.trailmap.domain.community.exception.CommunityException;
import com.all4land.trailmap.domain.community.repository.map.CommunityMapQueryRepository;
import com.all4land.trailmap.domain.community.repository.photo.CommunityPhotoQueryRepository;
import com.all4land.trailmap.domain.community.repository.photo.CommunityPhotoTargetRepository;
import com.all4land.trailmap.domain.community.repository.photo.PhotoRepository;
import com.all4land.trailmap.domain.community.repository.result.CommunityPhotoQueryResult;
import com.all4land.trailmap.domain.community.repository.result.CommunityPhotoTargetQueryResult;
import com.all4land.trailmap.domain.community.repository.review.CommunityReviewQueryRepository;
import com.all4land.trailmap.domain.community.repository.spot.CommunitySpotQueryRepository;
import com.all4land.trailmap.domain.community.storage.R2PhotoStorage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommunityPhotoService {

    private static final int MAX_PHOTO_COUNT = 3;

    private final CommunityMapQueryRepository mapQueryRepository;
    private final CommunityReviewQueryRepository reviewQueryRepository;
    private final CommunitySpotQueryRepository spotQueryRepository;
    private final CommunityPhotoTargetRepository targetRepository;
    private final CommunityPhotoQueryRepository photoQueryRepository;
    private final PhotoRepository photoRepository;
    private final R2PhotoStorage r2PhotoStorage;

    public CommunityPhotoUploadUrlResponse requestUploadUrl(
            Long userId,
            CommunityPhotoUploadUrlRequest request
    ) {
        validateUser(userId);
        var target = findOwnedTarget(userId, request.targetType(), request.targetId(), false);
        validatePhotoLimit(request.targetType(), request.targetId());

        String objectKey = objectKeyPrefix(target)
                + UUID.randomUUID() + "." + extension(request.mediaType());
        var upload = r2PhotoStorage.createUploadUrl(objectKey, request.mediaType());
        return new CommunityPhotoUploadUrlResponse(objectKey, upload.url(), upload.expiresAt());
    }

    @Transactional
    public CommunityPhotoResponse confirmPhoto(Long userId, CommunityPhotoConfirmRequest request) {
        validateUser(userId);
        var target = findOwnedTarget(userId, request.targetType(), request.targetId(), true);
        validatePhotoLimit(request.targetType(), request.targetId());
        validateObjectKey(target, request.objectKey(), request.mediaType());
        if (photoRepository.existsByObjectKey(request.objectKey())) {
            throw new CommunityException(CommunityErrorCode.INVALID_PHOTO);
        }

        var metadata = r2PhotoStorage.findMetadata(request.objectKey())
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.PHOTO_OBJECT_NOT_FOUND));
        if (metadata.contentLength() != request.fileSizeBytes()
                || !request.mediaType().equalsIgnoreCase(metadata.contentType())) {
            throw new CommunityException(CommunityErrorCode.INVALID_PHOTO);
        }

        Photo photo = photoRepository.saveAndFlush(Photo.create(
                userId,
                request.targetType(),
                request.targetId(),
                request.objectKey(),
                request.originalFileName(),
                request.mediaType(),
                request.fileSizeBytes(),
                request.displayOrder()
        ));
        return photoQueryRepository.findPhoto(photo.getPhotoId())
                .map(this::toResponse)
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.PHOTO_NOT_FOUND));
    }

    public List<CommunityPhotoResponse> getMountainPhotos(Long userId, Long mountainId, Integer limit, Integer offset) {
        validateUser(userId);
        if (!mapQueryRepository.existsMountain(mountainId)) {
            throw new CommunityException(CommunityErrorCode.MOUNTAIN_NOT_FOUND);
        }
        return toResponses(photoQueryRepository.findMountainPhotos(mountainId, limit, offset));
    }

    public List<CommunityPhotoResponse> getCoursePhotos(Long userId, Long courseId, Integer limit, Integer offset) {
        validateUser(userId);
        if (!mapQueryRepository.existsCourse(courseId)) {
            throw new CommunityException(CommunityErrorCode.COURSE_NOT_FOUND);
        }
        return toResponses(photoQueryRepository.findCoursePhotos(courseId, limit, offset));
    }

    public List<CommunityPhotoResponse> getSpotPhotos(
            Long userId,
            Long mountainId,
            CommunitySpotTargetType targetType,
            Long targetId,
            Integer limit,
            Integer offset
    ) {
        validateUser(userId);
        if (!mapQueryRepository.existsMountain(mountainId)) {
            throw new CommunityException(CommunityErrorCode.MOUNTAIN_NOT_FOUND);
        }
        if (spotQueryRepository.findSpot(userId, mountainId, targetType, targetId).isEmpty()) {
            throw new CommunityException(CommunityErrorCode.SPOT_NOT_FOUND);
        }
        return toResponses(photoQueryRepository.findSpotPhotos(targetType, targetId, limit, offset));
    }

    public CommunityPhotoResponse getPhoto(Long userId, Long photoId) {
        validateUser(userId);
        return photoQueryRepository.findPhoto(photoId)
                .map(this::toResponse)
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.PHOTO_NOT_FOUND));
    }

    private CommunityPhotoTargetQueryResult findOwnedTarget(
            Long userId,
            CommunityPhotoTargetType targetType,
            Long targetId,
            boolean lock
    ) {
        var target = (lock
                ? targetRepository.lockTarget(targetType, targetId)
                : targetRepository.findTarget(targetType, targetId))
                .orElseThrow(() -> new CommunityException(CommunityErrorCode.PHOTO_TARGET_NOT_FOUND));
        if (!userId.equals(target.ownerUserId())) {
            throw new CommunityException(CommunityErrorCode.PHOTO_FORBIDDEN);
        }
        return target;
    }

    private void validatePhotoLimit(CommunityPhotoTargetType targetType, Long targetId) {
        long count = switch (targetType) {
            case MOUNTAIN_REVIEW -> photoRepository.countByMountainReviewIdAndDeletedAtIsNull(targetId);
            case COURSE_REVIEW -> photoRepository.countByCourseReviewIdAndDeletedAtIsNull(targetId);
            case SPOT_REVIEW -> photoRepository.countBySpotReviewIdAndDeletedAtIsNull(targetId);
            case USER_SPOT -> photoRepository.countBySpotIdAndDeletedAtIsNull(targetId);
        };
        if (count >= MAX_PHOTO_COUNT) {
            throw new CommunityException(CommunityErrorCode.PHOTO_LIMIT_EXCEEDED);
        }
    }

    private void validateObjectKey(
            CommunityPhotoTargetQueryResult target,
            String objectKey,
            String mediaType
    ) {
        String expectedPrefix = objectKeyPrefix(target);
        String expectedSuffix = "." + extension(mediaType);
        if (!objectKey.startsWith(expectedPrefix)
                || !objectKey.toLowerCase(Locale.ROOT).endsWith(expectedSuffix)) {
            throw new CommunityException(CommunityErrorCode.INVALID_PHOTO);
        }
        String identifier = objectKey.substring(
                expectedPrefix.length(),
                objectKey.length() - expectedSuffix.length()
        );
        try {
            UUID.fromString(identifier);
        } catch (IllegalArgumentException exception) {
            throw new CommunityException(CommunityErrorCode.INVALID_PHOTO);
        }
    }

    private static String objectKeyPrefix(CommunityPhotoTargetQueryResult target) {
        return switch (target.targetType()) {
            case MOUNTAIN_REVIEW -> "community/mountain/%d/%d/"
                    .formatted(target.parentId(), target.targetId());
            case COURSE_REVIEW -> "community/course/%d/%d/"
                    .formatted(target.parentId(), target.targetId());
            case SPOT_REVIEW -> "community/spot/%s/%d/%d/"
                    .formatted(target.parentType(), target.parentId(), target.targetId());
            case USER_SPOT -> "community/spot/user-spot/%d/"
                    .formatted(target.parentId());
        };
    }

    private static String extension(String mediaType) {
        return switch (mediaType.toLowerCase(Locale.ROOT)) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> throw new CommunityException(CommunityErrorCode.INVALID_PHOTO);
        };
    }

    private void validateUser(Long userId) {
        if (!reviewQueryRepository.existsUser(userId)) {
            throw new CommunityException(CommunityErrorCode.USER_NOT_FOUND);
        }
    }

    private List<CommunityPhotoResponse> toResponses(List<CommunityPhotoQueryResult> photos) {
        return photos.stream().map(this::toResponse).toList();
    }

    private CommunityPhotoResponse toResponse(CommunityPhotoQueryResult photo) {
        return new CommunityPhotoResponse(
                photo.photoId(),
                r2PhotoStorage.createReadUrl(photo.objectKey()),
                photo.originalFileName(),
                photo.mediaType(),
                photo.fileSizeBytes(),
                photo.displayOrder(),
                photo.author(),
                photo.reviewContent(),
                photo.createdAt(),
                photo.reviewRating()
        );
    }
}
