package com.all4land.trailmap.domain.community.entity;

import com.all4land.trailmap.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Getter
@Entity
@Table(name = "photo")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Photo extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "photo_id")
    private Long photoId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "mountain_review_id", updatable = false)
    private Long mountainReviewId;

    @Column(name = "course_review_id", updatable = false)
    private Long courseReviewId;

    @Column(name = "spot_review_id", updatable = false)
    private Long spotReviewId;

    @Column(name = "spot_id", updatable = false)
    private Long spotId;

    @Column(name = "facility_id", updatable = false)
    private Long facilityId;

    @Column(name = "object_key", nullable = false, length = 1024, updatable = false)
    private String objectKey;

    @Column(name = "original_file_name", nullable = false, length = 255, updatable = false)
    private String originalFileName;

    @Column(name = "media_type", nullable = false, length = 100, updatable = false)
    private String mediaType;

    @Column(name = "file_size_bytes", nullable = false, updatable = false)
    private Long fileSizeBytes;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    private Photo(
            Long userId,
            Long mountainReviewId,
            Long courseReviewId,
            Long spotReviewId,
            Long spotId,
            String objectKey,
            String originalFileName,
            String mediaType,
            Long fileSizeBytes,
            Integer displayOrder
    ) {
        this.userId = userId;
        this.mountainReviewId = mountainReviewId;
        this.courseReviewId = courseReviewId;
        this.spotReviewId = spotReviewId;
        this.spotId = spotId;
        this.objectKey = objectKey;
        this.originalFileName = originalFileName;
        this.mediaType = mediaType;
        this.fileSizeBytes = fileSizeBytes;
        this.displayOrder = displayOrder;
    }

    public static Photo create(
            Long userId,
            CommunityPhotoTargetType targetType,
            Long targetId,
            String objectKey,
            String originalFileName,
            String mediaType,
            Long fileSizeBytes,
            Integer displayOrder
    ) {
        return new Photo(
                userId,
                targetType == CommunityPhotoTargetType.MOUNTAIN_REVIEW ? targetId : null,
                targetType == CommunityPhotoTargetType.COURSE_REVIEW ? targetId : null,
                targetType == CommunityPhotoTargetType.SPOT_REVIEW ? targetId : null,
                targetType == CommunityPhotoTargetType.USER_SPOT ? targetId : null,
                objectKey,
                originalFileName,
                mediaType,
                fileSizeBytes,
                displayOrder
        );
    }
}
