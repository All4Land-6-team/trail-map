package com.all4land.trailmap.global.user;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 요청한 익명 사용자의 user_id를 Controller 파라미터로 받는다.
 * 사용자 식별 방식이 정해지기 전까지 {@link CurrentUserIdArgumentResolver}가 X-User-Id 헤더를 읽는다.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrentUserId {
}
