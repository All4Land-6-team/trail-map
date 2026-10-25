package com.all4land.trailmap.domain.community.repository.spot;

import com.all4land.trailmap.domain.community.entity.CommunityVoteType;
import com.all4land.trailmap.domain.community.entity.SpotVote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SpotVoteRepository extends JpaRepository<SpotVote, Long> {

    Optional<SpotVote> findByUserIdAndSpotId(Long userId, Long spotId);

    Optional<SpotVote> findByUserIdAndFacilityId(Long userId, Long facilityId);

    long countBySpotIdAndVoteType(Long spotId, CommunityVoteType voteType);

    long countByFacilityIdAndVoteType(Long facilityId, CommunityVoteType voteType);
}
