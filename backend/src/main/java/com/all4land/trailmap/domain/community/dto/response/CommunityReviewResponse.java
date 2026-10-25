package com.all4land.trailmap.domain.community.dto.response;

import com.all4land.trailmap.domain.community.entity.CommunityReviewKind;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record CommunityReviewResponse(
        Long reviewId,
        CommunityReviewKind kind,
        Long targetId,
        Long hikeRecordId,
        String author,
        String content,
        Double rating,
        LocalDate visitedDate,
        OffsetDateTime createdAt,
        List<String> photoUrls
) {
}
