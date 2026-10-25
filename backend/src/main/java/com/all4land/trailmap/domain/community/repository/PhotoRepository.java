package com.all4land.trailmap.domain.community.repository;

import com.all4land.trailmap.domain.community.entity.Photo;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PhotoRepository extends JpaRepository<Photo, Long> {

    boolean existsByObjectKey(String objectKey);

    long countByMountainReviewIdAndDeletedAtIsNull(Long reviewId);

    long countByCourseReviewIdAndDeletedAtIsNull(Long reviewId);

    long countBySpotReviewIdAndDeletedAtIsNull(Long reviewId);

    long countBySpotIdAndDeletedAtIsNull(Long spotId);
}
