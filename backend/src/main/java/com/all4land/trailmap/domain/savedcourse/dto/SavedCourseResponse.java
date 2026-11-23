package com.all4land.trailmap.domain.savedcourse.dto;

import java.time.OffsetDateTime;

/**
 * 등산 담기에 담은 코스 한 건.
 *
 * @param mountainKey 코스 경로 카탈로그의 산 키(예: bukhansan). 화면이 코스 경로를 불러올 때 쓴다. 경로가 없는 코스면 null
 */
public record SavedCourseResponse(long courseId, long mountainId, String mountainKey, OffsetDateTime savedAt) {
}
