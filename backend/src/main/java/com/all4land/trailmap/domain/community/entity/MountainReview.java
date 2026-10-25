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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Getter
@Entity
@Table(name = "mountain_review")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MountainReview extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "review_id")
    private Long reviewId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "mountain_id", nullable = false, updatable = false)
    private Long mountainId;

    @Column(name = "hike_record_id", updatable = false)
    private Long hikeRecordId;

    @Column(name = "review_content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "visited_date")
    private LocalDate visitedDate;

    @Column(name = "rating")
    private BigDecimal rating;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    private MountainReview(Long userId, Long mountainId, Long hikeRecordId, String content,
                           LocalDate visitedDate, BigDecimal rating) {
        this.userId = userId;
        this.mountainId = mountainId;
        this.hikeRecordId = hikeRecordId;
        this.content = content;
        this.visitedDate = visitedDate;
        this.rating = rating;
    }

    public static MountainReview create(Long userId, Long mountainId, Long hikeRecordId, String content,
                                        LocalDate visitedDate, int rating) {
        return new MountainReview(
                userId, mountainId, hikeRecordId, content, visitedDate, BigDecimal.valueOf(rating)
        );
    }
}
