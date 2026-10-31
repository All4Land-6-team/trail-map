package com.all4land.trailmap.domain.community.repository.review;

import com.all4land.trailmap.domain.community.entity.SpotReview;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpotReviewRepository extends JpaRepository<SpotReview, Long> {
    boolean existsByHikeRecordIdAndSpotIdAndDeletedAtIsNull(Long hikeRecordId, Long spotId);

    boolean existsByHikeRecordIdAndFacilityIdAndDeletedAtIsNull(Long hikeRecordId, Long facilityId);
}
