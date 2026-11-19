package com.all4land.trailmap.domain.hike.dto.request;

import java.time.OffsetDateTime;

/**
 * @param endedAt 기기에서 등산 종료를 누른 시각. 통신이 끊긴 동안 누른 종료를 나중에 보낼 때 쓴다.
 *                없으면 서버가 요청을 받은 시각으로 종료한다.
 */
public record HikeRecordFinishRequest(
        OffsetDateTime endedAt
) {
}
