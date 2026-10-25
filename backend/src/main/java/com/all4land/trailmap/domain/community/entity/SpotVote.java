package com.all4land.trailmap.domain.community.entity;

import com.all4land.trailmap.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "spot_vote")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SpotVote extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "vote_id")
    private Long voteId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "spot_id", updatable = false)
    private Long spotId;

    @Column(name = "facility_id", updatable = false)
    private Long facilityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "vote_type", nullable = false)
    private CommunityVoteType voteType;

    private SpotVote(Long userId, Long spotId, Long facilityId, CommunityVoteType voteType) {
        this.userId = userId;
        this.spotId = spotId;
        this.facilityId = facilityId;
        this.voteType = voteType;
    }

    public static SpotVote create(
            Long userId,
            CommunitySpotTargetType targetType,
            Long targetId,
            CommunityVoteType voteType
    ) {
        return new SpotVote(
                userId,
                targetType == CommunitySpotTargetType.USER_SPOT ? targetId : null,
                targetType == CommunitySpotTargetType.FACILITY ? targetId : null,
                voteType
        );
    }

    public void change(CommunityVoteType voteType) {
        this.voteType = voteType;
    }
}
