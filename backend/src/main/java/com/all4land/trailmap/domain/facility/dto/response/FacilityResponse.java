package com.all4land.trailmap.domain.facility.dto.response;

import com.all4land.trailmap.domain.facility.entity.FacilityType;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record FacilityResponse(
        long facilityId, Long mountainId, String name, FacilityType type,
        double longitude, double latitude, String sourceReportedStatus,
        String sourceRecordId, LocalDate sourceDate, OffsetDateTime importedAt,
        Double distanceMeters, Source source
) {
    public record Source(long sourceId, String name, String provider, String url,
                         String format, String crs, String version) {}
}
