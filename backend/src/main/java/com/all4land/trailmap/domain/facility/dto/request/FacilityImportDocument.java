package com.all4land.trailmap.domain.facility.dto.request;

import com.all4land.trailmap.domain.facility.entity.FacilityType;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;

/** 모든 원본 어댑터가 만드는 공통 JSON v1. 좌표는 WGS84 경도, 위도 순서다. */
public record FacilityImportDocument(
        @NotNull @Min(1) @Max(1) Integer schemaVersion,
        @NotNull @Valid Source source,
        @NotEmpty @Size(max = 100000) List<@NotNull @Valid FacilityInput> facilities,
        JsonNode report
) {
    public record Source(
            @NotBlank @Size(max = 200) String name,
            @Size(max = 200) String provider,
            @Size(max = 2000) String url,
            @NotBlank @Size(max = 30) String format,
            @NotBlank @Size(max = 100) String crs,
            @NotBlank @Size(max = 100) String version
    ) {}

    @JsonPropertyOrder({"sourceRecordId", "type", "name", "longitude", "latitude", "sourceReportedStatus", "sourceDate"})
    public record FacilityInput(
            @NotBlank @Size(max = 200) String sourceRecordId,
            @NotNull FacilityType type,
            @Size(max = 200) String name,
            @NotNull Double longitude,
            @NotNull Double latitude,
            @Size(max = 100) String sourceReportedStatus,
            LocalDate sourceDate
    ) {}
}
