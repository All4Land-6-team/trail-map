package com.all4land.trailmap.domain.hike.dto.response;

import java.util.List;

/**
 * 등산 기록으로 작성한 후기 (REC-03).
 * 산·코스 후기는 기록마다 하나만 쓸 수 있어 이미 썼으면 후기 유형 선택에서 막는다. 스팟 후기는 스팟마다 쓸 수 있다.
 */
public record HikeRecordReviewsResponse(
        boolean mountainReviewed,
        boolean courseReviewed,
        List<HikeRecordReviewResponse> reviews
) {
}
