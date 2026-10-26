package com.all4land.trailmap.domain.user.dto.response;

import com.all4land.trailmap.domain.user.entity.AppUser;

public record UserProfileResponse(
        Long userId,
        String nickname
) {

    private static final String DEFAULT_NICKNAME_PREFIX = "익명";

    public static UserProfileResponse from(AppUser user) {
        return new UserProfileResponse(
                user.getUserId(),
                user.getNickname() == null ? DEFAULT_NICKNAME_PREFIX + user.getUserId() : user.getNickname()
        );
    }
}
