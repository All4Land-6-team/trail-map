package com.all4land.trailmap.domain.parkcontrol.dto.response;

import java.time.Instant;
import java.util.List;

public record ControlResponse(long courseId, String mountainKey, String coverage, String availability, Office office) {
    public record Office(String sourceRecordId, String name, String status, String collectionState, boolean stale,
            Instant sourceAsOf, Instant checkedAt, Instant detailFetchedAt, String reason, String restrictedSection,
            String restrictionPeriodText, String contentText, String contact, String sourceUrl, List<Asset> assets) {}
    public record Asset(String kind, String name, String sourceUrl, String imageUrl) {}
}
