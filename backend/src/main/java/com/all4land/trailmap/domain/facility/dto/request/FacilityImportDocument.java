package com.all4land.trailmap.domain.facility.dto.request;

import com.all4land.trailmap.domain.facility.entity.FacilityType;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;

/** 후보 선택과 산 소속 판정을 완료한 공통 JSON v2. 좌표는 WGS84 경도, 위도 순서다. */
public record FacilityImportDocument(
        @NotNull @Min(2) @Max(2) Integer schemaVersion,
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
            LocalDate sourceDate,
            @JsonProperty(required = true) @Positive Long mountainId
    ) {}
}
