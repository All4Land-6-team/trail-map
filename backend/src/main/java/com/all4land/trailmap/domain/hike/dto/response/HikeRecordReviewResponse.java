package com.all4land.trailmap.domain.hike.dto.response;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 등산 기록으로 작성한 후기 한 건 (REC-03 등산 기록 상세 아래 목록).
 *
 * @param kind       MOUNTAIN(산 평점·후기), COURSE(코스 후기), SPOT(스팟 사진·후기)
 * @param targetType MOUNTAIN, COURSE, 스팟이면 커뮤니티 스팟 종류(USER_SPOT, FACILITY)
 * @param rating     코스 후기 평점(1~5, V12부터 코스 후기에 저장). 코스 후기가 아니거나 평점이 없으면 null
 * @param photoIds   후기에 붙인 사진 번호. 주소는 GET /v1/community/photos/{photoId}로 받는다.
 */
public record HikeRecordReviewResponse(
        String kind,
        Long reviewId,
        String targetType,
        Long targetId,
        String targetName,
        Double rating,
        String content,
        LocalDate visitedDate,
        OffsetDateTime createdAt,
        List<Long> photoIds
) {
}
