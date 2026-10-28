package com.all4land.trailmap.domain.courseanalysis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** 직접 계산할 수 있는 3개 샘플: 거리 20m, 상승 10m, 하강 5m. 실측 자료가 아니다. */
public final class AnalysisTestDocuments {
    private AnalysisTestDocuments() {}

    public static ObjectMapper mapper() {
        return new ObjectMapper().registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    public static ObjectNode document(ObjectMapper mapper) {
        try {
            return (ObjectNode) mapper.readTree("""
                    {
                      "schema_version":1,"algorithm_version":"course-dem-v1","source_type":"SERVICE_CALCULATED",
                      "calculated_at":"2026-10-28T00:00:00.123456+00:00","quality_status":"AVAILABLE","quality_reasons":[],
                      "course":{"course_id":1,"mountain_id":2,"course_version":1,"source_id":3,
                        "course_name":"합성 테스트 코스","source_kind":"development",
                        "geometry":{"type":"LineString","coordinates":[[10.0,10.0],[10.0002,10.0]]}},
                      "inputs":{"course":{"path":"/local/test/course.geojson",
                        "sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
                        "dem":{"path":"/local/test/dem.tif",
                          "sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                          "crs_wkt":"synthetic-test-projected-crs","crs_authority":null,
                          "linear_unit":"metre","linear_unit_to_meters":1.0,"band_unit":"m",
                          "band_scale":1.0,"band_offset":0.0,"auxiliary_files":[]}},
                      "settings":{"sample_interval_meters":10.0,"sampling_method":"bilinear",
                        "resampling_method":"horizontal_chainage_preserve_vertices","distance_method":"projected_2d_dem_crs",
                        "elevation_unit":"m","elevation_unit_source":"raster_metadata","vertical_reference":"synthetic-test-only",
                        "elevation_processing":"unsmoothed","slope_convention":"signed_percent_from_previous_sample","max_samples":100000},
                      "diagnostics":{"removed_consecutive_duplicate_count":0,"sample_status_counts":{"VALID":3}},
                      "summary":{"distance_meters":20.0,"sample_count":3,"valid_dem_sample_count":3,
                        "valid_elevation_meters_sample_count":3,"sample_coverage_percent":100.0,"covered_distance_meters":20.0,
                        "distance_coverage_percent":100.0,"min_elevation_meters":100.0,"max_elevation_meters":110.0,
                        "elevation_gain_meters":10.0,"elevation_loss_meters":5.0,"analyzed_segment_count":2},
                      "profile":[
                        {"sample_index":0,"distance_meters":0.0,"longitude":10.0,"latitude":10.0,
                          "elevation_source_value":100.0,"elevation_meters":100.0,"slope_percent":null,"sample_status":"VALID"},
                        {"sample_index":1,"distance_meters":10.0,"longitude":10.0001,"latitude":10.0,
                          "elevation_source_value":110.0,"elevation_meters":110.0,"slope_percent":100.0,"sample_status":"VALID"},
                        {"sample_index":2,"distance_meters":20.0,"longitude":10.0002,"latitude":10.0,
                          "elevation_source_value":105.0,"elevation_meters":105.0,"slope_percent":-50.0,"sample_status":"VALID"}
                      ]
                    }
                    """);
        } catch (IOException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public static ObjectNode section(ObjectNode node, String name) { return (ObjectNode) node.get(name); }
    public static ObjectNode sample(ObjectNode node, int index) { return (ObjectNode) node.get("profile").get(index); }

    public static Path write(Path directory, ObjectMapper mapper, JsonNode document) throws IOException {
        Path file = Files.createTempFile(directory, "course-analysis-", ".json");
        mapper.writeValue(file.toFile(), document);
        return file;
    }
}
