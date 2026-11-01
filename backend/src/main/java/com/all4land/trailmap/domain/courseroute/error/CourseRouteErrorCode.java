package com.all4land.trailmap.domain.courseroute.error;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum CourseRouteErrorCode implements BaseResponseCode {
    INVALID_REQUEST("ROUTE_400_1", 400, "코스 ID 또는 산 식별자가 올바르지 않습니다."),
    INVALID_DOCUMENT("ROUTE_400_2", 400, "13개 코스 GeoJSON 또는 산 매핑이 올바르지 않습니다."),
    NOT_FOUND("ROUTE_404_1", 404, "코스를 찾을 수 없습니다."),
    IMPORT_CONFLICT("ROUTE_409_1", 409, "이미 등록된 경로 데이터와 입력이 다릅니다. 기존 코스와 분석은 변경하지 않습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
