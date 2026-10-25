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

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Getter
@Entity
@Table(name = "spot_review")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SpotReview extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "review_id")
    private Long reviewId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "spot_id", updatable = false)
    private Long spotId;

    @Column(name = "facility_id", updatable = false)
    private Long facilityId;

    @Column(name = "hike_record_id", updatable = false)
    private Long hikeRecordId;

    @Column(name = "review_content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "visited_date")
    private LocalDate visitedDate;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    private SpotReview(Long userId, Long spotId, Long facilityId, Long hikeRecordId,
                       String content, LocalDate visitedDate) {
        this.userId = userId;
        this.spotId = spotId;
        this.facilityId = facilityId;
        this.hikeRecordId = hikeRecordId;
        this.content = content;
        this.visitedDate = visitedDate;
    }

    public static SpotReview create(Long userId, CommunitySpotTargetType targetType, Long targetId,
                                    Long hikeRecordId, String content, LocalDate visitedDate) {
        return new SpotReview(
                userId,
                targetType == CommunitySpotTargetType.USER_SPOT ? targetId : null,
                targetType == CommunitySpotTargetType.FACILITY ? targetId : null,
                hikeRecordId,
                content,
                visitedDate
        );
    }
}
