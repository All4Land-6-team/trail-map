package com.all4land.trailmap.domain.community.error;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

import static com.all4land.trailmap.global.constant.HttpStatusCode.BAD_REQUEST;
import static com.all4land.trailmap.global.constant.HttpStatusCode.CONFLICT;
import static com.all4land.trailmap.global.constant.HttpStatusCode.FORBIDDEN;
import static com.all4land.trailmap.global.constant.HttpStatusCode.NOT_FOUND;

@Getter
@AllArgsConstructor
public enum CommunityErrorCode implements BaseResponseCode {
    USER_NOT_FOUND("COMMUNITY_404_1", NOT_FOUND, "사용자를 찾을 수 없습니다."),
    MOUNTAIN_NOT_FOUND("COMMUNITY_404_2", NOT_FOUND, "산을 찾을 수 없습니다."),
    COURSE_NOT_FOUND("COMMUNITY_404_3", NOT_FOUND, "코스를 찾을 수 없습니다."),
    SPOT_NOT_FOUND("COMMUNITY_404_4", NOT_FOUND, "스팟을 찾을 수 없습니다."),
    INVALID_REVIEW_REQUEST("COMMUNITY_400_1", BAD_REQUEST, "후기 요청 값이 올바르지 않습니다."),
    REVIEW_NOT_ELIGIBLE("COMMUNITY_403_1", FORBIDDEN, "후기를 작성할 수 있는 산행 기록이 아닙니다."),
    DUPLICATE_SPOT_CANDIDATE("COMMUNITY_409_1", CONFLICT, "30m 이내에 같은 유형의 스팟이 있습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
