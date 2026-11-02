package com.all4land.trailmap.domain.auth.service;

import com.all4land.trailmap.domain.auth.dto.request.LoginRequest;
import com.all4land.trailmap.domain.auth.dto.request.SignupRequest;
import com.all4land.trailmap.domain.auth.dto.response.AuthSessionResponse;
import com.all4land.trailmap.domain.auth.dto.response.AuthUserResponse;
import com.all4land.trailmap.domain.auth.entity.UserSession;
import com.all4land.trailmap.domain.auth.error.AuthErrorCode;
import com.all4land.trailmap.domain.auth.exception.AuthException;
import com.all4land.trailmap.domain.auth.repository.UserSessionRepository;
import com.all4land.trailmap.domain.user.entity.AppUser;
import com.all4land.trailmap.domain.user.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private static final Duration SESSION_DURATION = Duration.ofDays(7);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String BEARER_PREFIX = "Bearer ";

    private final AppUserRepository userRepository;
    private final UserSessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public AuthSessionResponse signup(SignupRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new AuthException(AuthErrorCode.EMAIL_ALREADY_EXISTS);
        }

        AppUser user = AppUser.registered(request.nickname().trim(), email, passwordEncoder.encode(request.password()));
        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw new AuthException(AuthErrorCode.EMAIL_ALREADY_EXISTS);
        }
        return createSession(user);
    }

    @Transactional
    public AuthSessionResponse login(LoginRequest request) {
        AppUser user = userRepository.findByEmailIgnoreCase(normalizeEmail(request.email()))
                .filter(candidate -> candidate.getPasswordHash() != null)
                .orElseThrow(() -> new AuthException(AuthErrorCode.INVALID_CREDENTIALS));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new AuthException(AuthErrorCode.INVALID_CREDENTIALS);
        }
        return createSession(user);
    }

    public AuthUserResponse me(String authorizationHeader) {
        return AuthUserResponse.from(activeSession(authorizationHeader).getUser());
    }

    @Transactional
    public void logout(String authorizationHeader) {
        activeSession(authorizationHeader).revoke(Instant.now());
    }

    public Long resolveUserId(String authorizationHeader, String legacyUserIdHeader) {
        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            return activeSession(authorizationHeader).getUser().getUserId();
        }
        if (legacyUserIdHeader != null && !legacyUserIdHeader.isBlank()) {
            try {
                long userId = Long.parseLong(legacyUserIdHeader.trim());
                if (userId > 0) return userId;
            } catch (NumberFormatException ignored) {
                // 테스트 환경의 레거시 헤더도 유효한 양수만 허용한다.
            }
        }
        throw new AuthException(AuthErrorCode.AUTHENTICATION_REQUIRED);
    }

    private AuthSessionResponse createSession(AppUser user) {
        byte[] tokenBytes = new byte[32];
        SECURE_RANDOM.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        Instant expiresAt = Instant.now().plus(SESSION_DURATION);
        sessionRepository.save(UserSession.create(user, hashToken(token), expiresAt));
        return new AuthSessionResponse(token, "Bearer", expiresAt, AuthUserResponse.from(user));
    }

    private UserSession activeSession(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_PREFIX)) {
            throw new AuthException(AuthErrorCode.AUTHENTICATION_REQUIRED);
        }
        String token = authorizationHeader.substring(BEARER_PREFIX.length()).trim();
        if (token.isEmpty()) throw new AuthException(AuthErrorCode.AUTHENTICATION_REQUIRED);

        UserSession session = sessionRepository.findByTokenHash(hashToken(token))
                .orElseThrow(() -> new AuthException(AuthErrorCode.INVALID_SESSION));
        if (!session.isActive(Instant.now())) throw new AuthException(AuthErrorCode.INVALID_SESSION);
        return session;
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
