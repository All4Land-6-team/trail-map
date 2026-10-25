package com.all4land.trailmap.domain.community.repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record CommunityReviewQueryResult(
        Long reviewId,
        Long targetId,
        Long hikeRecordId,
        String author,
        String content,
        Double rating,
        LocalDate visitedDate,
        OffsetDateTime createdAt,
        List<String> photoKeys
) {
}
