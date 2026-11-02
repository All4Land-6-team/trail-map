package com.all4land.trailmap.domain.auth.dto.response;

import com.all4land.trailmap.domain.user.entity.AppUser;

public record AuthUserResponse(Long userId, String nickname, String email) {

    public static AuthUserResponse from(AppUser user) {
        return new AuthUserResponse(user.getUserId(), user.getNickname(), user.getEmail());
    }
}
