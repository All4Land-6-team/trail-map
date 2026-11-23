package com.all4land.trailmap.domain.savedcourse;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 실제 PostgreSQL + PostGIS에 Flyway migration을 적용하고 등산 담기 API를 끝까지 호출한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class SavedCourseApiIntegrationTest {

    private static final DockerImageName POSTGIS_IMAGE = DockerImageName
            .parse("pgrouting/pgrouting:16-3.5-3.8")
            .asCompatibleSubstituteFor("postgres");

    @Container
    @ServiceConnection
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("trail_map")
            .withUsername("postgres")
            .withPassword("postgres");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbcTemplate;

    long userId;
    long otherUserId;
    long courseId;
    long otherCourseId;

    @BeforeEach
    void setUp() {
        userId = insertUser();
        otherUserId = insertUser();
        long sourceId = jdbcTemplate.queryForObject(
                "INSERT INTO data_source (source_name, source_format) VALUES ('test', 'GEOJSON') RETURNING source_id",
                Long.class
        );
        long mountainId = jdbcTemplate.queryForObject("""
                INSERT INTO mountain (mountain_name, mountain_display_location, source_id, source_hash, imported_at)
                VALUES ('북한산', ST_SetSRID(ST_MakePoint(126.98, 37.66), 4326), ?, ?, now())
                RETURNING mountain_id
                """, Long.class, sourceId, hash());
        courseId = insertCourse(mountainId, sourceId, "백운대 코스");
        otherCourseId = insertCourse(mountainId, sourceId, "의상능선 코스");
    }

    @Test
    void 담은_코스를_담은_순서대로_조회하고_다시_담아도_한_건이다() throws Exception {
        mockMvc.perform(asUser(userId, put("/v1/saved-courses/" + courseId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.courseId").value(courseId));
        mockMvc.perform(asUser(userId, put("/v1/saved-courses/" + otherCourseId))).andExpect(status().isOk());
        mockMvc.perform(asUser(userId, put("/v1/saved-courses/" + courseId))).andExpect(status().isOk());   // 다시 담기

        mockMvc.perform(asUser(userId, get("/v1/saved-courses")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].courseId").value(courseId))
                .andExpect(jsonPath("$.data[1].courseId").value(otherCourseId));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM saved_course WHERE user_id = ? AND deleted_at IS NULL", Integer.class, userId))
                .isEqualTo(2);
    }

    @Test
    void 빼면_목록에서_사라지고_다시_담을_수_있다() throws Exception {
        mockMvc.perform(asUser(userId, put("/v1/saved-courses/" + courseId))).andExpect(status().isOk());
        mockMvc.perform(asUser(userId, delete("/v1/saved-courses/" + courseId))).andExpect(status().isOk());
        mockMvc.perform(asUser(userId, delete("/v1/saved-courses/" + courseId))).andExpect(status().isOk());  // 이미 뺀 코스

        mockMvc.perform(asUser(userId, get("/v1/saved-courses")))
                .andExpect(jsonPath("$.data", hasSize(0)));

        mockMvc.perform(asUser(userId, put("/v1/saved-courses/" + courseId))).andExpect(status().isOk());
        mockMvc.perform(asUser(userId, get("/v1/saved-courses")))
                .andExpect(jsonPath("$.data", hasSize(1)));
        // 뺀 기록은 지우지 않고 남긴다
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM saved_course WHERE user_id = ? AND course_id = ?", Integer.class, userId, courseId))
                .isEqualTo(2);
    }

    @Test
    void 다른_사용자의_담은_코스는_보이지_않는다() throws Exception {
        mockMvc.perform(asUser(userId, put("/v1/saved-courses/" + courseId))).andExpect(status().isOk());

        mockMvc.perform(asUser(otherUserId, get("/v1/saved-courses")))
                .andExpect(jsonPath("$.data", hasSize(0)));
        mockMvc.perform(asUser(otherUserId, delete("/v1/saved-courses/" + courseId))).andExpect(status().isOk());
        mockMvc.perform(asUser(userId, get("/v1/saved-courses")))
                .andExpect(jsonPath("$.data", hasSize(1)));                  // 다른 사용자가 빼도 내 담기는 그대로
    }

    @Test
    void 없는_코스나_사용자면_404를_반환한다() throws Exception {
        mockMvc.perform(asUser(userId, put("/v1/saved-courses/999999")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SAVED_404_2"));
        mockMvc.perform(asUser(999999, get("/v1/saved-courses")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SAVED_404_1"));
    }

    private static MockHttpServletRequestBuilder asUser(long requestUserId, MockHttpServletRequestBuilder request) {
        return request.header("X-User-Id", requestUserId);
    }

    private long insertUser() {
        return jdbcTemplate.queryForObject("INSERT INTO app_user DEFAULT VALUES RETURNING user_id", Long.class);
    }

    private long insertCourse(long mountainId, long sourceId, String name) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO course (mountain_id, course_name, course_geometry, official_distance_meters,
                                    official_duration_seconds, source_id, source_hash, imported_at)
                VALUES (?, ?, ST_GeomFromText('LINESTRING(126.97 37.65, 126.98 37.66)', 4326), 4200, 10800, ?, ?, now())
                RETURNING course_id
                """, Long.class, mountainId, name, sourceId, hash());
    }

    private static String hash() {
        return (UUID.randomUUID().toString() + UUID.randomUUID()).replace("-", "");
    }
}
