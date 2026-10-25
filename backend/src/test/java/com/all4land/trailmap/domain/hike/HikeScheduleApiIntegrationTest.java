package com.all4land.trailmap.domain.hike;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 실제 PostgreSQL + PostGIS에 Flyway migration을 적용하고 일정 API를 끝까지 호출한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class HikeScheduleApiIntegrationTest {

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
        courseId = insertCourse(mountainId, sourceId, "백운대 코스", 4200);
        otherCourseId = insertCourse(mountainId, sourceId, "의상능선 코스", 6100);
    }

    @Test
    void 일정을_등록하고_기간과_상세로_조회한다() throws Exception {
        long scheduleId = createSchedule(userId, courseId, "2026-11-01", "07:30", false)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("SUCCESS_201"))
                .andExpect(jsonPath("$.data.date").value("2026-11-01"))
                .andExpect(jsonPath("$.data.startTime").value("07:30"))
                .andExpect(jsonPath("$.data.courseName").value("백운대 코스"))
                .andExpect(jsonPath("$.data.mountainName").value("북한산"))
                .andExpect(jsonPath("$.data.distanceMeters").value(4200.0))
                .andReturn().getResponse().getContentAsString().transform(this::scheduleId);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT to_char(scheduled_starts_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') FROM hike_schedule WHERE schedule_id = ?",
                String.class, scheduleId
        )).isEqualTo("2026-11-01 07:30");

        mockMvc.perform(asUser(userId, get("/v1/hike-schedules").param("from", "2026-11-01").param("to", "2026-11-30")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].scheduleId").value(scheduleId));

        mockMvc.perform(asUser(userId, get("/v1/hike-schedules").param("from", "2026-11-02").param("to", "2026-11-30")))
                .andExpect(jsonPath("$.data.length()").value(0));

        mockMvc.perform(asUser(userId, get("/v1/hike-schedules/" + scheduleId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.courseId").value(courseId));
    }

    @Test
    void 같은_날짜에_일정이_있으면_충돌하고_대체를_요청하면_기존_일정을_삭제한다() throws Exception {
        long firstId = createSchedule(userId, courseId, "2026-11-03", "06:00", false)
                .andReturn().getResponse().getContentAsString().transform(this::scheduleId);

        createSchedule(userId, otherCourseId, "2026-11-03", "09:00", false)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HIKE_409_1"));

        long replacedId = createSchedule(userId, otherCourseId, "2026-11-03", "09:00", true)
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString().transform(this::scheduleId);

        assertThat(replacedId).isNotEqualTo(firstId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT deleted_at IS NOT NULL FROM hike_schedule WHERE schedule_id = ?", Boolean.class, firstId
        )).isTrue();
        mockMvc.perform(asUser(userId, get("/v1/hike-schedules").param("from", "2026-11-03").param("to", "2026-11-03")))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].courseName").value("의상능선 코스"));
    }

    @Test
    void 일정을_수정하고_삭제하면_같은_날짜에_다시_등록할_수_있다() throws Exception {
        long scheduleId = createSchedule(userId, courseId, "2026-11-05", "07:00", false)
                .andReturn().getResponse().getContentAsString().transform(this::scheduleId);
        createSchedule(userId, courseId, "2026-11-06", "07:00", false).andExpect(status().isCreated());

        mockMvc.perform(asUser(userId, patch("/v1/hike-schedules/" + scheduleId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"startTime": "08:10", "courseId": %d}
                                """.formatted(otherCourseId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.date").value("2026-11-05"))
                .andExpect(jsonPath("$.data.startTime").value("08:10"))
                .andExpect(jsonPath("$.data.courseName").value("의상능선 코스"));

        mockMvc.perform(asUser(userId, patch("/v1/hike-schedules/" + scheduleId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date": "2026-11-06"}
                                """))
                .andExpect(status().isConflict());

        mockMvc.perform(asUser(userId, delete("/v1/hike-schedules/" + scheduleId)))
                .andExpect(status().isOk());
        mockMvc.perform(asUser(userId, get("/v1/hike-schedules/" + scheduleId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("HIKE_404_3"));

        createSchedule(userId, courseId, "2026-11-05", "07:00", false).andExpect(status().isCreated());
    }

    @Test
    void 다른_사용자의_일정은_조회_수정_삭제할_수_없다() throws Exception {
        long scheduleId = createSchedule(userId, courseId, "2026-11-07", "07:00", false)
                .andReturn().getResponse().getContentAsString().transform(this::scheduleId);

        mockMvc.perform(asUser(otherUserId, get("/v1/hike-schedules/" + scheduleId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(asUser(otherUserId, patch("/v1/hike-schedules/" + scheduleId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"startTime": "10:00"}
                                """))
                .andExpect(status().isNotFound());
        mockMvc.perform(asUser(otherUserId, delete("/v1/hike-schedules/" + scheduleId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(asUser(otherUserId, get("/v1/hike-schedules").param("from", "2026-11-07").param("to", "2026-11-07")))
                .andExpect(jsonPath("$.data.length()").value(0));

        // 다른 사용자는 같은 날짜에 자기 일정을 등록할 수 있다.
        createSchedule(otherUserId, courseId, "2026-11-07", "07:00", false).andExpect(status().isCreated());
    }

    @Test
    void 없는_사용자나_코스면_404를_반환한다() throws Exception {
        createSchedule(Long.MAX_VALUE, courseId, "2026-11-09", "07:00", false)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("HIKE_404_1"));
        createSchedule(userId, Long.MAX_VALUE, "2026-11-09", "07:00", false)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("HIKE_404_2"));
    }

    @Test
    void 일정_종료는_완료_산행을_한_번만_생성한다() throws Exception {
        long scheduleId = createSchedule(userId, courseId, "2026-11-10", "07:00", false)
                .andReturn().getResponse().getContentAsString().transform(this::scheduleId);

        mockMvc.perform(asUser(userId, post("/v1/hike-schedules/" + scheduleId + "/complete")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.scheduleId").value(scheduleId))
                .andExpect(jsonPath("$.data.courseId").value(courseId));
        mockMvc.perform(asUser(userId, post("/v1/hike-schedules/" + scheduleId + "/complete")))
                .andExpect(status().isCreated());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM hike_record WHERE schedule_id = ? AND hike_status = 'COMPLETED'",
                Integer.class, scheduleId
        )).isEqualTo(1);
    }

    private ResultActions createSchedule(long requestUserId, long requestCourseId, String date, String startTime,
                                         boolean replaceExisting) throws Exception {
        return mockMvc.perform(asUser(requestUserId, post("/v1/hike-schedules"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"courseId": %d, "date": "%s", "startTime": "%s", "replaceExisting": %b}
                        """.formatted(requestCourseId, date, startTime, replaceExisting)));
    }

    private static MockHttpServletRequestBuilder asUser(long requestUserId, MockHttpServletRequestBuilder request) {
        return request.header("X-User-Id", requestUserId);
    }

    private long scheduleId(String responseBody) {
        return Long.parseLong(responseBody.replaceAll(".*\"scheduleId\":(\\d+).*", "$1"));
    }

    private long insertUser() {
        return jdbcTemplate.queryForObject("INSERT INTO app_user DEFAULT VALUES RETURNING user_id", Long.class);
    }

    private long insertCourse(long mountainId, long sourceId, String name, double distanceMeters) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO course (mountain_id, course_name, course_geometry, official_distance_meters,
                                    official_duration_seconds, source_id, source_hash, imported_at)
                VALUES (?, ?, ST_GeomFromText('LINESTRING(126.97 37.65, 126.98 37.66)', 4326), ?, 10800, ?, ?, now())
                RETURNING course_id
                """, Long.class, mountainId, name, distanceMeters, sourceId, hash());
    }

    private static String hash() {
        return (UUID.randomUUID().toString() + UUID.randomUUID()).replace("-", "");
    }
}
