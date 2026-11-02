package com.all4land.trailmap.global.user;

import com.all4land.trailmap.domain.auth.service.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * 임시 사용자 식별: X-User-Id 헤더의 양수 user_id를 사용한다.
 * 팀 공통 사용자 식별 방식이 정해지면 이 클래스만 교체한다.
 */
@org.springframework.stereotype.Component
public class CurrentUserIdArgumentResolver implements HandlerMethodArgumentResolver {

    public static final String USER_ID_HEADER = "X-User-Id";
    private static final String AUTHORIZATION_HEADER = "Authorization";

    private final ObjectProvider<AuthService> authServiceProvider;

    @Value("${app.auth.legacy-user-header-enabled:false}")
    private boolean legacyUserHeaderEnabled;

    public CurrentUserIdArgumentResolver(ObjectProvider<AuthService> authServiceProvider) {
        this.authServiceProvider = authServiceProvider;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentUserId.class)
                && Long.class.equals(parameter.getParameterType());
    }

    @Override
    public Long resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory
    ) {
        AuthService authService = authServiceProvider.getIfAvailable();
        String legacyHeader = webRequest.getHeader(USER_ID_HEADER);
        if (authService != null) {
            return authService.resolveUserId(
                    webRequest.getHeader(AUTHORIZATION_HEADER),
                    legacyUserHeaderEnabled ? legacyHeader : null
            );
        }
        return resolveLegacyTestUser(legacyHeader);
    }

    private Long resolveLegacyTestUser(String header) {
        if (header != null && !header.isBlank()) {
            try {
                long userId = Long.parseLong(header.trim());
                if (userId > 0) return userId;
            } catch (NumberFormatException ignored) {
                // WebMvc slice tests keep using the legacy header without loading the auth domain.
            }
        }
        throw new com.all4land.trailmap.domain.auth.exception.AuthException(
                com.all4land.trailmap.domain.auth.error.AuthErrorCode.AUTHENTICATION_REQUIRED
        );
    }
}
