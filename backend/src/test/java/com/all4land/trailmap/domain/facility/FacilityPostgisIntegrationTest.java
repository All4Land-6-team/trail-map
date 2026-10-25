package com.all4land.trailmap.domain.facility;

import com.all4land.trailmap.domain.facility.dto.request.FacilityImportDocument;
import com.all4land.trailmap.domain.facility.dto.request.FacilityImportDocument.FacilityInput;
import com.all4land.trailmap.domain.facility.dto.request.FacilityImportDocument.Source;
import com.all4land.trailmap.domain.facility.entity.FacilityType;
import com.all4land.trailmap.domain.facility.service.FacilityImportService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.closeTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 명시적으로 지정한 개발용 PostGIS에서 실행한다. 테스트 데이터는 매번 롤백한다. */
@SpringBootTest(properties = {
        "spring.datasource.url=${FACILITY_TEST_JDBC_URL}",
        "spring.datasource.username=${FACILITY_TEST_DB_USERNAME:postgres}",
        "spring.datasource.password=${FACILITY_TEST_DB_PASSWORD}",
        "terrain.root-path=${java.io.tmpdir}",
        "facility.review.enabled=true"
})
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "FACILITY_TEST_JDBC_URL", matches = "jdbc:postgresql:.*")
class FacilityPostgisIntegrationTest {
    @Autowired FacilityImportService importer;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @TempDir Path temporary;

    private final Source source = new Source("facility-test-" + UUID.randomUUID(), "test", null,
            "TEST", "EPSG:4326", "20141219");

    @Test
    void importsPointsAndRepeatedImportDoesNotDuplicateOrUpdate() throws Exception {
        Path file = document(List.of(point("1", 10.01, 10.0005, FacilityType.RESTROOM),
                point("2", 10.01, 10.0005, FacilityType.RESTROOM)));
        var first = importer.importFile(file);
        var again = importer.importFile(file);
        assertThat(first.inserted()).isEqualTo(2);
        assertThat(again.sourceId()).isEqualTo(first.sourceId());
        assertThat(again.inserted()).isZero();
        assertThat(again.skipped()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM facility WHERE source_id = ?", Integer.class, first.sourceId()))
                .isEqualTo(2);
        long id = jdbc.queryForObject("SELECT min(facility_id) FROM facility WHERE source_id = ?", Long.class, first.sourceId());
        assertThat(jdbc.queryForObject("SELECT ST_SRID(facility_location) FROM facility WHERE facility_id = ?", Integer.class, id))
                .isEqualTo(4326);
        mvc.perform(get("/v1/facilities/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.longitude").value(10.01))
                .andExpect(jsonPath("$.data.latitude").value(10.0005))
                .andExpect(jsonPath("$.data.sourceDate").value("2014-12-19"))
                .andExpect(jsonPath("$.data.sourceReportedStatus").value("USE_YN=1"))
                .andExpect(jsonPath("$.data.source.sourceId").value(first.sourceId()));
        mvc.perform(get("/v1/facilities/review").param("sourceId", String.valueOf(first.sourceId())))
                .andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith("application/geo+json"))
                .andExpect(jsonPath("$.type").value("FeatureCollection"))
                .andExpect(jsonPath("$.features.length()").value(2))
                .andExpect(jsonPath("$.features[0].geometry.coordinates[0]").value(10.01));
    }

    @Test
    void usesMetersAndEntireCourseLineAndFiltersFacilityType() throws Exception {
        var result = importer.importFile(document(List.of(
                point("near", 10.01, 10.0005, FacilityType.RESTROOM),
                point("far", 10.01, 10.01, FacilityType.RESTROOM),
                point("shelter", 10.01, 10.0005, FacilityType.SHELTER))));
        long mountainId = jdbc.queryForObject("""
                INSERT INTO mountain (mountain_name, mountain_display_location, source_id, source_hash, imported_at)
                VALUES ('test', ST_SetSRID(ST_MakePoint(10,10),4326), ?, ?, now()) RETURNING mountain_id
                """, Long.class, result.sourceId(), "a".repeat(64));
        long courseId = jdbc.queryForObject("""
                INSERT INTO course (mountain_id, course_name, course_geometry, source_id, source_hash, imported_at)
                VALUES (?, 'test', ST_GeomFromText('LINESTRING(10 10,10.02 10)',4326), ?, ?, now()) RETURNING course_id
                """, Long.class, mountainId, result.sourceId(), "b".repeat(64));
        String endpoint = "/v1/courses/" + courseId + "/facilities";
        // near는 시작점에서 약 1.1km 떨어져 있지만 코스 중간 선에서는 약 55m다.
        mvc.perform(get(endpoint).param("type", "RESTROOM").param("radiusMeters", "100"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].sourceRecordId").value("near"))
                .andExpect(jsonPath("$.data[0].distanceMeters").value(closeTo(55.3, 1)));
        mvc.perform(get(endpoint).param("radiusMeters", "100"))
                .andExpect(jsonPath("$.data.length()").value(2));
        mvc.perform(get(endpoint).param("type", "RESTROOM").param("radiusMeters", "50"))
                .andExpect(jsonPath("$.data.length()").value(0));
        mvc.perform(get(endpoint).param("type", "RESTROOM").param("radiusMeters", "2000"))
                .andExpect(jsonPath("$.data.length()").value(2));
        mvc.perform(get(endpoint).param("type", "UNKNOWN")).andExpect(status().isBadRequest());
        mvc.perform(get(endpoint).param("radiusMeters", "NaN")).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsInvalidCoordinatesBeforeCreatingSource() throws Exception {
        assertThatThrownBy(() -> importer.importFile(document(List.of(point("bad", 181, 37, FacilityType.RESTROOM)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("coordinates");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM data_source WHERE source_name = ?", Integer.class, source.name()))
                .isZero();
    }

    @Test
    void rejectsDuplicateIdentifiersAndChangedExistingData() throws Exception {
        var original = point("1", 10, 10, FacilityType.RESTROOM);
        assertThatThrownBy(() -> importer.importFile(document(List.of(original, original))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Duplicate");
    }

    @Test
    void changedSnapshotDoesNotUpdateExistingRecord() throws Exception {
        var first = importer.importFile(document(List.of(point("1", 10, 10, FacilityType.RESTROOM))));
        assertThatThrownBy(() -> importer.importFile(document(List.of(point("1", 11, 10, FacilityType.RESTROOM)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("update is not supported");
        assertThat(jdbc.queryForObject("SELECT ST_X(facility_location) FROM facility WHERE source_id = ?", Double.class, first.sourceId()))
                .isEqualTo(10);
    }

    @Test
    void returnsExplicitNotFoundAndBadRequestResponses() throws Exception {
        mvc.perform(get("/v1/facilities/9223372036854775807")).andExpect(status().isNotFound());
        mvc.perform(get("/v1/courses/9223372036854775807/facilities")).andExpect(status().isNotFound());
        mvc.perform(get("/v1/facilities/review")).andExpect(status().isBadRequest());
        mvc.perform(get("/v1/facilities/review").param("sourceId", "9223372036854775807"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/v1/facilities/-1")).andExpect(status().isBadRequest());
    }

    private FacilityInput point(String id, double longitude, double latitude, FacilityType type) {
        return new FacilityInput(id, type, "시험 시설", longitude, latitude, "USE_YN=1", LocalDate.of(2014, 12, 19));
    }

    private Path document(List<FacilityInput> records) throws Exception {
        Path file = temporary.resolve(UUID.randomUUID() + ".json");
        mapper.writeValue(file.toFile(), new FacilityImportDocument(1, source, records, null));
        return file;
    }
}
