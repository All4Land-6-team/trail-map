package com.all4land.trailmap.domain.user.service;

import com.all4land.trailmap.domain.user.dto.request.UserNicknameUpdateRequest;
import com.all4land.trailmap.domain.user.dto.response.UserProfileResponse;
import com.all4land.trailmap.domain.user.entity.AppUser;
import com.all4land.trailmap.domain.user.error.UserErrorCode;
import com.all4land.trailmap.domain.user.exception.UserException;
import com.all4land.trailmap.domain.user.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserProfileService {

    private final AppUserRepository userRepository;

    public UserProfileResponse getProfile(Long userId) {
        return UserProfileResponse.from(getUser(userId));
    }

    @Transactional
    public UserProfileResponse updateNickname(Long userId, UserNicknameUpdateRequest request) {
        AppUser user = getUser(userId);
        String nickname = request.nickname().trim();
        user.changeNickname(nickname.isEmpty() ? null : nickname);
        return UserProfileResponse.from(user);
    }

    private AppUser getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UserException(UserErrorCode.USER_NOT_FOUND));
    }
}
