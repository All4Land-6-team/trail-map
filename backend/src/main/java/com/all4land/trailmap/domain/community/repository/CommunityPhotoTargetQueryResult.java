package com.all4land.trailmap.domain.community.repository;

import com.all4land.trailmap.domain.community.entity.CommunityPhotoTargetType;

public record CommunityPhotoTargetQueryResult(
        CommunityPhotoTargetType targetType,
        Long targetId,
        Long ownerUserId,
        String parentType,
        Long parentId
) {
}
