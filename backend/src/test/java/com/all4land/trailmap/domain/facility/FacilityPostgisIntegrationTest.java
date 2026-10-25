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
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.HexFormat;
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
        importer.importFile(document(List.of(
                assigned(point("near", 10.01, 10.0005, FacilityType.RESTROOM), mountainId),
                assigned(point("far", 10.01, 10.01, FacilityType.RESTROOM), mountainId),
                assigned(point("shelter", 10.01, 10.0005, FacilityType.SHELTER), mountainId),
                assigned(point("water", 10.01, 10.0005, FacilityType.DRINKING_WATER), mountainId))));
        long otherMountain = mountain(result.sourceId());
        importer.importFile(document(List.of(
                assigned(point("other-near", 10.01, 10.0005, FacilityType.RESTROOM), otherMountain),
                assigned(point("other-far", 10.01, 10.01, FacilityType.RESTROOM), otherMountain),
                point("unassigned-near", 10.01, 10.0005, FacilityType.RESTROOM),
                point("unassigned-far", 10.01, 10.01, FacilityType.RESTROOM))));
        String endpoint = "/v1/courses/" + courseId + "/facilities";
        // near는 시작점에서 약 1.1km 떨어져 있지만 코스 중간 선에서는 약 55m다.
        mvc.perform(get(endpoint).param("type", "RESTROOM").param("radiusMeters", "100"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].sourceRecordId").value("near"))
                .andExpect(jsonPath("$.data[0].distanceMeters").value(closeTo(55.3, 1)));
        mvc.perform(get(endpoint).param("radiusMeters", "100"))
                .andExpect(jsonPath("$.data.length()").value(3));
        mvc.perform(get(endpoint).param("type", "DRINKING_WATER").param("radiusMeters", "100"))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].sourceRecordId").value("water"));
        // 경계가 바뀌어도 조회는 저장된 소속을 사용한다. 재판정/적재는 별도 작업이다.
        jdbc.update("UPDATE mountain SET mountain_boundary = ST_Multi(ST_MakeEnvelope(20,20,21,21,4326)) WHERE mountain_id = ?", mountainId);
        mvc.perform(get(endpoint).param("type", "RESTROOM").param("radiusMeters", "50"))
                .andExpect(jsonPath("$.data.length()").value(0));
        mvc.perform(get(endpoint).param("type", "RESTROOM").param("radiusMeters", "2000"))
                .andExpect(jsonPath("$.data.length()").value(2));
        mvc.perform(get(endpoint).param("type", "UNKNOWN")).andExpect(status().isBadRequest());
        mvc.perform(get(endpoint).param("radiusMeters", "NaN")).andExpect(status().isBadRequest());
        mvc.perform(get("/v1/facilities/review").param("sourceId", String.valueOf(result.sourceId())))
                .andExpect(jsonPath("$.features.length()").value(8));
    }

    @Test
    void changesOnlyMembershipAndPreservesLegacyHashIdsAndReports() throws Exception {
        var original = point("legacy", 10, 10, FacilityType.RESTROOM);
        var first = importer.importFile(document(List.of(original)));
        long mountainId = mountain(first.sourceId());
        long id = jdbc.queryForObject("SELECT facility_id FROM facility WHERE source_id = ?", Long.class, first.sourceId());
        // 기존 v1이 직렬화하던 7개 필드의 바이트 순서와 해시를 고정해서 검증한다.
        String legacyJson = "{\"sourceRecordId\":\"legacy\",\"type\":\"RESTROOM\",\"name\":\"시험 시설\","
                + "\"longitude\":10.0,\"latitude\":10.0,\"sourceReportedStatus\":\"USE_YN=1\",\"sourceDate\":\"2014-12-19\"}";
        String legacyHash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(legacyJson.getBytes(StandardCharsets.UTF_8)));
        assertThat(jdbc.queryForObject("SELECT source_hash FROM facility WHERE facility_id = ?", String.class, id))
                .isEqualTo(legacyHash);
        String before = jdbc.queryForObject("SELECT (to_jsonb(f)-'mountain_id')::text FROM facility f WHERE facility_id = ?", String.class, id);
        long userId = jdbc.queryForObject("INSERT INTO app_user DEFAULT VALUES RETURNING user_id", Long.class);
        long reportId = jdbc.queryForObject("""
                INSERT INTO facility_report (facility_id,user_id,report_type,visited_date)
                VALUES (?,?,'AVAILABLE',CURRENT_DATE) RETURNING facility_report_id
                """, Long.class, id, userId);
        var inside = document(List.of(assigned(original, mountainId)));
        assertThat(importer.importFile(inside).updated()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT mountain_id FROM facility WHERE facility_id = ?", Long.class, id))
                .isEqualTo(mountainId);
        var repeat = importer.importFile(inside);
        assertThat(repeat.updated()).isZero();
        assertThat(repeat.skipped()).isEqualTo(1);
        assertThat(importer.importFile(document(List.of(original))).updated()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT mountain_id FROM facility WHERE facility_id = ?", Long.class, id)).isNull();
        assertThat(jdbc.queryForObject("SELECT (to_jsonb(f)-'mountain_id')::text FROM facility f WHERE facility_id = ?", String.class, id))
                .isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT facility_id FROM facility_report WHERE facility_report_id = ?", Long.class, reportId))
                .isEqualTo(id);
        mvc.perform(get("/v1/facilities/" + id)).andExpect(status().isOk());
    }

    @Test
    void insertsWithExplicitMountainAndRejectsUnclassifiedDocuments() throws Exception {
        var first = importer.importFile(document(List.of(point("base", 10, 10, FacilityType.RESTROOM))));
        long mountainId = mountain(first.sourceId());
        var input = assigned(point("new", 10, 10, FacilityType.DRINKING_WATER), mountainId);
        var result = importer.importFile(document(List.of(input)));
        assertThat(result.inserted()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT mountain_id FROM facility WHERE source_id = ? AND source_record_id = 'new'",
                Long.class, first.sourceId())).isEqualTo(mountainId);
        Path file = document(List.of(input));
        var tree = mapper.readTree(file.toFile());
        ((com.fasterxml.jackson.databind.node.ObjectNode) tree.get("facilities").get(0)).remove("mountainId");
        mapper.writeValue(file.toFile(), tree);
        assertThatThrownBy(() -> importer.importFile(file)).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cannot read");
    }

    @Test
    void changedOriginalPreventsAllMembershipUpdatesInSameFile() throws Exception {
        var a = point("a", 10, 10, FacilityType.RESTROOM);
        var b = point("b", 10, 10, FacilityType.RESTROOM);
        var first = importer.importFile(document(List.of(a, b)));
        long mountainId = mountain(first.sourceId());
        assertThatThrownBy(() -> importer.importFile(document(List.of(assigned(a, mountainId),
                assigned(point("b", 11, 10, FacilityType.RESTROOM), mountainId)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("update is not supported");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM facility WHERE source_id = ? AND mountain_id IS NOT NULL",
                Integer.class, first.sourceId())).isZero();
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
        return new FacilityInput(id, type, "시험 시설", longitude, latitude, "USE_YN=1", LocalDate.of(2014, 12, 19), null);
    }

    private FacilityInput assigned(FacilityInput input, Long mountainId) {
        return new FacilityInput(input.sourceRecordId(), input.type(), input.name(), input.longitude(),
                input.latitude(), input.sourceReportedStatus(), input.sourceDate(), mountainId);
    }

    private long mountain(long sourceId) {
        return jdbc.queryForObject("""
                INSERT INTO mountain (mountain_name,mountain_display_location,source_id,source_hash,imported_at)
                VALUES ('membership-test',ST_SetSRID(ST_MakePoint(10,10),4326),?, ?,now()) RETURNING mountain_id
                """, Long.class, sourceId, "c".repeat(64));
    }

    private Path document(List<FacilityInput> records) throws Exception {
        Path file = temporary.resolve(UUID.randomUUID() + ".json");
        mapper.writeValue(file.toFile(), new FacilityImportDocument(2, source, records, null));
        return file;
    }
}
