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
    PHOTO_TARGET_NOT_FOUND("COMMUNITY_404_5", NOT_FOUND, "사진을 연결할 대상을 찾을 수 없습니다."),
    PHOTO_NOT_FOUND("COMMUNITY_404_6", NOT_FOUND, "사진을 찾을 수 없습니다."),
    INVALID_REVIEW_REQUEST("COMMUNITY_400_1", BAD_REQUEST, "후기 요청 값이 올바르지 않습니다."),
    INVALID_SPOT_CURSOR("COMMUNITY_400_5", BAD_REQUEST, "스팟 목록 이어보기 값이 올바르지 않습니다."),
    INVALID_PHOTO("COMMUNITY_400_2", BAD_REQUEST, "사진 정보가 올바르지 않습니다."),
    PHOTO_LIMIT_EXCEEDED("COMMUNITY_400_3", BAD_REQUEST, "대상별 사진은 최대 3장까지 등록할 수 있습니다."),
    PHOTO_OBJECT_NOT_FOUND("COMMUNITY_400_4", BAD_REQUEST, "R2에 업로드된 사진을 찾을 수 없습니다."),
    REVIEW_NOT_ELIGIBLE("COMMUNITY_403_1", FORBIDDEN, "후기를 작성할 수 있는 산행 기록이 아닙니다."),
    PHOTO_FORBIDDEN("COMMUNITY_403_2", FORBIDDEN, "다른 사용자의 대상에는 사진을 연결할 수 없습니다."),
    DUPLICATE_SPOT_CANDIDATE("COMMUNITY_409_1", CONFLICT, "50m 이내에 같은 유형의 스팟이 있습니다.");

    private final String code;
    private final int httpStatus;
    private final String message;
}
