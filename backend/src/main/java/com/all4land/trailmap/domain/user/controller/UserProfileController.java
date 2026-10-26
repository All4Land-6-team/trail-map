package com.all4land.trailmap.domain.user.controller;

import com.all4land.trailmap.domain.user.dto.request.UserNicknameUpdateRequest;
import com.all4land.trailmap.domain.user.dto.response.UserProfileResponse;
import com.all4land.trailmap.domain.user.service.UserProfileService;
import com.all4land.trailmap.global.response.SuccessResponse;
import com.all4land.trailmap.global.user.CurrentUserId;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/users/me")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;

    @GetMapping
    public ResponseEntity<SuccessResponse<UserProfileResponse>> getProfile(@CurrentUserId Long userId) {
        return response(SuccessResponse.ok(userProfileService.getProfile(userId)));
    }

    @PatchMapping
    public ResponseEntity<SuccessResponse<UserProfileResponse>> updateNickname(
            @CurrentUserId Long userId,
            @Valid @RequestBody UserNicknameUpdateRequest request
    ) {
        return response(SuccessResponse.ok(userProfileService.updateNickname(userId, request)));
    }

    private static <T> ResponseEntity<SuccessResponse<T>> response(SuccessResponse<T> body) {
        return ResponseEntity.status(body.getHttpStatus()).body(body);
    }
}
