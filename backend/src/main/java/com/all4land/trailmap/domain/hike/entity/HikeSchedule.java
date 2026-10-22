package com.all4land.trailmap.domain.hike.entity;

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
@Table(name = "hike_schedule")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class HikeSchedule extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_id")
    private Long scheduleId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "course_id", nullable = false)
    private Long courseId;

    @Column(name = "scheduled_starts_at", nullable = false)
    private OffsetDateTime scheduledStartsAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    private HikeSchedule(Long userId, Long courseId, OffsetDateTime scheduledStartsAt) {
        this.userId = userId;
        this.courseId = courseId;
        this.scheduledStartsAt = scheduledStartsAt;
    }

    public static HikeSchedule create(Long userId, Long courseId, OffsetDateTime scheduledStartsAt) {
        return new HikeSchedule(userId, courseId, scheduledStartsAt);
    }

    public void change(Long courseId, OffsetDateTime scheduledStartsAt) {
        this.courseId = courseId;
        this.scheduledStartsAt = scheduledStartsAt;
    }

    public void delete(OffsetDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }
}
