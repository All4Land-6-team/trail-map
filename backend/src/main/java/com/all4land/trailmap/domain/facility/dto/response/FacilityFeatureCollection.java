package com.all4land.trailmap.domain.facility.dto.response;

import java.util.List;

/** 지도 검토 도구에서 바로 읽을 수 있는 GeoJSON. */
public record FacilityFeatureCollection(String type, List<Feature> features) {
    public static FacilityFeatureCollection from(List<FacilityResponse> facilities) {
        return new FacilityFeatureCollection("FeatureCollection", facilities.stream()
                .map(facility -> new Feature("Feature", facility.facilityId(),
                        new Geometry("Point", List.of(facility.longitude(), facility.latitude())), facility))
                .toList());
    }

    public record Feature(String type, long id, Geometry geometry, FacilityResponse properties) {}
    public record Geometry(String type, List<Double> coordinates) {}
}
