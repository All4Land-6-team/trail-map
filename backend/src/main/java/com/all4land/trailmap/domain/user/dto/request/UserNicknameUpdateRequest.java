package com.all4land.trailmap.domain.user.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UserNicknameUpdateRequest(
        @NotNull @Size(max = 12) String nickname
) {
}
