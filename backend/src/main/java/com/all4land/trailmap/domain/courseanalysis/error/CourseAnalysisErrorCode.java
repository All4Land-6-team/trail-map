package com.all4land.trailmap.domain.courseanalysis.error;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

import static com.all4land.trailmap.global.constant.HttpStatusCode.BAD_REQUEST;
import static com.all4land.trailmap.global.constant.HttpStatusCode.CONFLICT;
import static com.all4land.trailmap.global.constant.HttpStatusCode.NOT_FOUND;

@Getter
@AllArgsConstructor
public enum CourseAnalysisErrorCode implements BaseResponseCode {
    INVALID_IDENTIFIER("ANALYSIS_400_1", BAD_REQUEST, "코스와 분석 ID는 양의 정수여야 합니다."),
    INVALID_DOCUMENT("ANALYSIS_400_2", BAD_REQUEST, "분석 JSON 형식 또는 계산 결과가 올바르지 않습니다."),
    COURSE_NOT_FOUND("ANALYSIS_404_1", NOT_FOUND, "코스를 찾을 수 없습니다."),
    ANALYSIS_NOT_FOUND("ANALYSIS_404_2", NOT_FOUND, "분석 결과를 찾을 수 없습니다."),
    COURSE_CHANGED("ANALYSIS_409_1", CONFLICT, "현재 코스와 분석 입력의 산·버전·경로·출처가 다릅니다."),
    RESULT_CONFLICT("ANALYSIS_409_2", CONFLICT, "동일한 분석 식별자에 다른 결과가 있습니다. 기존 결과는 변경하지 않습니다."),
    SOURCE_CONFLICT("ANALYSIS_409_3", CONFLICT, "DEM 출처 정보가 중복되거나 기존 정보와 다릅니다."),
    DATA_UNAVAILABLE("ANALYSIS_503_1", 503, "분석 파일을 사용할 수 없거나 DB 요약과 일치하지 않습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
