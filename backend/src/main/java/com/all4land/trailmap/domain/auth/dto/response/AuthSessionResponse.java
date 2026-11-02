package com.all4land.trailmap.domain.auth.dto.response;

import java.time.Instant;

public record AuthSessionResponse(
        String accessToken,
        String tokenType,
        Instant expiresAt,
        AuthUserResponse user
) {
}
