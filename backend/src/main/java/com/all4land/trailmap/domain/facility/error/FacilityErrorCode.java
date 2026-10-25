package com.all4land.trailmap.domain.facility.error;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

import static com.all4land.trailmap.global.constant.HttpStatusCode.BAD_REQUEST;
import static com.all4land.trailmap.global.constant.HttpStatusCode.NOT_FOUND;

@Getter
@AllArgsConstructor
public enum FacilityErrorCode implements BaseResponseCode {
    INVALID_QUERY("FACILITY_400_1", BAD_REQUEST, "시설 조회 조건이 올바르지 않습니다. 반경은 1~5000m입니다."),
    FACILITY_NOT_FOUND("FACILITY_404_1", NOT_FOUND, "시설을 찾을 수 없습니다."),
    COURSE_NOT_FOUND("FACILITY_404_2", NOT_FOUND, "코스를 찾을 수 없습니다."),
    SOURCE_NOT_FOUND("FACILITY_404_3", NOT_FOUND, "시설 데이터 출처를 찾을 수 없습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
