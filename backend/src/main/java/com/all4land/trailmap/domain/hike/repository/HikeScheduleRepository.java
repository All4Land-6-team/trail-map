package com.all4land.trailmap.domain.hike.repository;

import com.all4land.trailmap.domain.hike.entity.HikeSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface HikeScheduleRepository extends JpaRepository<HikeSchedule, Long> {

    Optional<HikeSchedule> findByScheduleIdAndUserIdAndDeletedAtIsNull(Long scheduleId, Long userId);

    /** [from, to) 사이에 출발하는 사용자의 삭제되지 않은 일정을 출발 시각 순으로 조회한다. */
    @Query("""
            SELECT schedule
            FROM HikeSchedule schedule
            WHERE schedule.userId = :userId
              AND schedule.deletedAt IS NULL
              AND schedule.scheduledStartsAt >= :from
              AND schedule.scheduledStartsAt < :to
            ORDER BY schedule.scheduledStartsAt
            """)
    List<HikeSchedule> findActiveSchedules(
            @Param("userId") Long userId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to
    );
}
