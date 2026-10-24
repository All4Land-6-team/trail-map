package com.all4land.trailmap.global.user;

import com.all4land.trailmap.global.exception.BaseException;
import com.all4land.trailmap.global.response.code.ErrorResponseCode;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * 임시 사용자 식별: X-User-Id 헤더의 양수 user_id를 사용한다.
 * 팀 공통 사용자 식별 방식이 정해지면 이 클래스만 교체한다.
 */
public class CurrentUserIdArgumentResolver implements HandlerMethodArgumentResolver {

    public static final String USER_ID_HEADER = "X-User-Id";

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
        String header = webRequest.getHeader(USER_ID_HEADER);
        if (header == null || header.isBlank()) {
            throw new BaseException(ErrorResponseCode.MISSING_USER_ID);
        }

        try {
            long userId = Long.parseLong(header.trim());
            if (userId <= 0) {
                throw new BaseException(ErrorResponseCode.MISSING_USER_ID);
            }
            return userId;
        } catch (NumberFormatException exception) {
            throw new BaseException(ErrorResponseCode.MISSING_USER_ID);
        }
    }
}
