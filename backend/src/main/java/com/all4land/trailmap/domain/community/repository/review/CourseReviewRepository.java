package com.all4land.trailmap.domain.community.repository.review;

import com.all4land.trailmap.domain.community.entity.CourseReview;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseReviewRepository extends JpaRepository<CourseReview, Long> {
    boolean existsByHikeRecordIdAndCourseIdAndDeletedAtIsNull(Long hikeRecordId, Long courseId);
}
