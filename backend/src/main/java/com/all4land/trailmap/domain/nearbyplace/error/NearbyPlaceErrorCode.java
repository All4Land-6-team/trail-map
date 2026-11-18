package com.all4land.trailmap.domain.nearbyplace.error;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum NearbyPlaceErrorCode implements BaseResponseCode {
    KAKAO_API_NOT_CONFIGURED("PLACE_503_1", 503, "주변 장소 검색 설정이 준비되지 않았습니다."),
    COURSE_COVERAGE_LIMIT_EXCEEDED("PLACE_422_1", 422, "요청 제한 안에서 코스 전체를 검색할 수 없습니다."),
    KAKAO_API_UNAVAILABLE("PLACE_502_1", 502, "주변 장소 제공 서비스에 일시적으로 연결할 수 없습니다."),
    INVALID_UPSTREAM_RESPONSE("PLACE_502_2", 502, "주변 장소 제공 서비스의 응답을 처리할 수 없습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
