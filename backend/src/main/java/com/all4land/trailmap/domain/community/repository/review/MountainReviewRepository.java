package com.all4land.trailmap.domain.community.repository.review;

import com.all4land.trailmap.domain.community.entity.MountainReview;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MountainReviewRepository extends JpaRepository<MountainReview, Long> {
    boolean existsByHikeRecordIdAndMountainIdAndDeletedAtIsNull(Long hikeRecordId, Long mountainId);
}
