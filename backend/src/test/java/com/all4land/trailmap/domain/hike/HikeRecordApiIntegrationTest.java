package com.all4land.trailmap.domain.hike;

import com.jayway.jsonpath.JsonPath;
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

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 실제 PostgreSQL + PostGIS에 Flyway migration을 적용하고 등산 기록 API를 시작부터 종료까지 호출한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class HikeRecordApiIntegrationTest {

    private static final DockerImageName POSTGIS_IMAGE = DockerImageName
            .parse("pgrouting/pgrouting:16-3.5-3.8")
            .asCompatibleSubstituteFor("postgres");

    @Container
    @ServiceConnection
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("trail_map")
            .withUsername("postgres")
            .withPassword("postgres");

    private static final String TODAY = LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
    private static final String TOMORROW = LocalDate.now(ZoneId.of("Asia/Seoul")).plusDays(1).toString();

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbcTemplate;

    long userId;
    long otherUserId;
    long courseId;

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
        courseId = jdbcTemplate.queryForObject("""
                INSERT INTO course (mountain_id, course_name, course_geometry, official_distance_meters,
                                    official_duration_seconds, source_id, source_hash, imported_at)
                VALUES (?, '백운대 코스', ST_GeomFromText('LINESTRING(126.97 37.65, 126.98 37.66)', 4326), 4200, 10800, ?, ?, now())
                RETURNING course_id
                """, Long.class, mountainId, sourceId, hash());
    }

    @Test
    void 등산을_시작하고_위치를_기록한_뒤_하산하고_종료한다() throws Exception {
        long scheduleId = createSchedule(userId, TODAY);

        long recordId = start(userId, scheduleId)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.courseName").value("백운대 코스"))
                .andExpect(jsonPath("$.data.mountainName").value("북한산"))
                .andExpect(jsonPath("$.data.endedAt").value(nullValue()))
                .andExpect(jsonPath("$.data.traveledDistanceMeters").value(nullValue()))
                .andExpect(jsonPath("$.data.traveledPath.length()").value(0))
                .andReturn().getResponse().getContentAsString().transform(body -> id(body, "$.data.hikeRecordId"));

        // 첫 위치 하나만 받아도 저장한다. 이동 거리는 0이다.
        sendPositions(userId, recordId, position(126.9700, 37.6500, "06:00:00", 5))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.acceptedCount").value(1))
                .andExpect(jsonPath("$.data.traveledDistanceMeters").value(0.0));

        // 북쪽으로 약 111m씩 두 번 이동. 순서가 섞여 와도 측정 시각 순으로 잇는다.
        sendPositions(userId, recordId,
                position(126.9700, 37.6520, "06:10:00", 8),
                position(126.9700, 37.6510, "06:05:00", 8))
                .andExpect(jsonPath("$.data.acceptedCount").value(2))
                .andExpect(jsonPath("$.data.traveledDistanceMeters").value(closeTo(222.0, 2.0)));

        mockMvc.perform(asUser(userId, post("/v1/hike-records/" + recordId + "/descend")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DESCENDING"));

        sendPositions(userId, recordId, position(126.9700, 37.6510, "06:30:00", 8))
                .andExpect(jsonPath("$.data.acceptedCount").value(1))
                .andExpect(jsonPath("$.data.traveledDistanceMeters").value(closeTo(333.0, 3.0)));

        mockMvc.perform(asUser(userId, post("/v1/hike-records/" + recordId + "/finish")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.endedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.actualDurationSeconds").isNumber())
                .andExpect(jsonPath("$.data.traveledDistanceMeters").value(closeTo(333.0, 3.0)))
                .andExpect(jsonPath("$.data.traveledPath.length()").value(4))
                .andExpect(jsonPath("$.data.traveledPath[0][0]").value(126.97))
                .andExpect(jsonPath("$.data.traveledPath[0][1]").value(37.65))
                .andExpect(jsonPath("$.data.traveledPath[3][1]").value(37.651));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT GeometryType(traveled_path) || ':' || ST_SRID(traveled_path) FROM hike_record WHERE hike_record_id = ?",
                String.class, recordId
        )).isEqualTo("LINESTRING:4326");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT ST_Equals(recorded_course_geometry, (SELECT course_geometry FROM course WHERE course_id = ?)) FROM hike_record WHERE hike_record_id = ?",
                Boolean.class, courseId, recordId
        )).isTrue();

        // 종료 재요청은 그대로 돌려주고, 종료 후 위치·하산 요청은 막는다.
        mockMvc.perform(asUser(userId, post("/v1/hike-records/" + recordId + "/finish")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
        sendPositions(userId, recordId, position(126.9800, 37.6600, "07:00:00", 5))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HIKE_409_5"));
        mockMvc.perform(asUser(userId, post("/v1/hike-records/" + recordId + "/descend")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HIKE_409_5"));
        mockMvc.perform(asUser(userId, get("/v1/hike-records/active")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    void 정확도가_낮거나_직전_위치와_가까운_위치는_경로에서_뺀다() throws Exception {
        long recordId = startedRecord(userId);

        sendPositions(userId, recordId,
                position(126.9700, 37.6500, "06:00:00", 5),
                position(126.9700, 37.65002, "06:00:10", 5),
                position(126.9800, 37.6600, "06:00:20", 120),
                position(126.9700, 37.6510, "06:01:00", null))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.acceptedCount").value(2))
                .andExpect(jsonPath("$.data.traveledDistanceMeters").value(closeTo(111.0, 1.0)));

        Double length = jdbcTemplate.queryForObject(
                "SELECT ST_Length(traveled_path::geography) FROM hike_record WHERE hike_record_id = ?",
                Double.class, recordId
        );
        assertThat(length).isCloseTo(111.2, within(1.0));
    }

    @Test
    void 진행_중_기록을_조회하고_오늘이_아니거나_이미_시작한_일정은_시작할_수_없다() throws Exception {
        long recordId = startedRecord(userId);

        mockMvc.perform(asUser(userId, get("/v1/hike-records/active")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hikeRecordId").value(recordId))
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"));

        long scheduleId = jdbcTemplate.queryForObject(
                "SELECT schedule_id FROM hike_record WHERE hike_record_id = ?", Long.class, recordId
        );
        start(userId, scheduleId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HIKE_409_3"));

        long tomorrowId = createSchedule(userId, TOMORROW);
        start(userId, tomorrowId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HIKE_409_2"));
    }

    @Test
    void 진행_중인_등산이_있으면_다른_일정을_시작할_수_없다() throws Exception {
        startedRecord(userId);
        // 하루 1개 일정 규칙이 있으므로 진행 중 기록의 일정을 지우고 같은 날 새 일정을 만든다.
        jdbcTemplate.update("UPDATE hike_schedule SET deleted_at = now() WHERE user_id = ?", userId);
        long secondScheduleId = createSchedule(userId, TODAY);

        start(userId, secondScheduleId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HIKE_409_4"));
    }

    @Test
    void 다른_사용자의_기록과_일정은_없는_것으로_처리한다() throws Exception {
        long recordId = startedRecord(userId);
        long scheduleId = jdbcTemplate.queryForObject(
                "SELECT schedule_id FROM hike_record WHERE hike_record_id = ?", Long.class, recordId
        );

        mockMvc.perform(asUser(otherUserId, get("/v1/hike-records/" + recordId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("HIKE_404_4"));
        sendPositions(otherUserId, recordId, position(126.97, 37.65, "06:00:00", 5))
                .andExpect(status().isNotFound());
        mockMvc.perform(asUser(otherUserId, post("/v1/hike-records/" + recordId + "/finish")))
                .andExpect(status().isNotFound());
        start(otherUserId, scheduleId)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("HIKE_404_3"));
    }

    @Test
    void 잘못된_좌표나_빈_위치_목록은_400을_반환한다() throws Exception {
        long recordId = startedRecord(userId);

        sendPositions(userId, recordId, position(200.0, 37.65, "06:00:00", 5))
                .andExpect(status().isBadRequest());
        mockMvc.perform(asUser(userId, post("/v1/hike-records/" + recordId + "/positions"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"positions\": []}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 일정_종료_API는_진행_중_기록을_종료한다() throws Exception {
        long recordId = startedRecord(userId);
        long scheduleId = jdbcTemplate.queryForObject(
                "SELECT schedule_id FROM hike_record WHERE hike_record_id = ?", Long.class, recordId
        );
        sendPositions(userId, recordId,
                position(126.9700, 37.6500, "06:00:00", 5),
                position(126.9700, 37.6510, "06:05:00", 5));

        mockMvc.perform(asUser(userId, post("/v1/hike-schedules/" + scheduleId + "/complete")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.hikeRecordId").value(recordId))
                .andExpect(jsonPath("$.data.endedAt").isNotEmpty());

        mockMvc.perform(asUser(userId, get("/v1/hike-records/" + recordId)))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.actualDurationSeconds").isNumber())
                .andExpect(jsonPath("$.data.traveledDistanceMeters").value(closeTo(111.0, 1.0)));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM hike_record WHERE schedule_id = ?", Integer.class, scheduleId
        )).isEqualTo(1);
    }

    private long startedRecord(long requestUserId) throws Exception {
        return start(requestUserId, createSchedule(requestUserId, TODAY))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString().transform(body -> id(body, "$.data.hikeRecordId"));
    }

    private ResultActions start(long requestUserId, long scheduleId) throws Exception {
        return mockMvc.perform(asUser(requestUserId, post("/v1/hike-records"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"scheduleId\": %d}".formatted(scheduleId)));
    }

    private ResultActions sendPositions(long requestUserId, long recordId, String... positions) throws Exception {
        return mockMvc.perform(asUser(requestUserId, post("/v1/hike-records/" + recordId + "/positions"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"positions\": [%s]}".formatted(String.join(",", positions))));
    }

    private static String position(double longitude, double latitude, String time, Integer accuracyMeters) {
        return """
                {"longitude": %s, "latitude": %s, "recordedAt": "%sT%s+09:00", "accuracyMeters": %s}
                """.formatted(longitude, latitude, TODAY, time, accuracyMeters);
    }

    private long createSchedule(long requestUserId, String date) throws Exception {
        return mockMvc.perform(asUser(requestUserId, post("/v1/hike-schedules"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"courseId": %d, "date": "%s", "startTime": "06:00", "replaceExisting": false}
                                """.formatted(courseId, date)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString().transform(body -> id(body, "$.data.scheduleId"));
    }

    private static MockHttpServletRequestBuilder asUser(long requestUserId, MockHttpServletRequestBuilder request) {
        return request.header("X-User-Id", requestUserId);
    }

    private static long id(String responseBody, String path) {
        return ((Number) JsonPath.read(responseBody, path)).longValue();
    }

    private long insertUser() {
        return jdbcTemplate.queryForObject("INSERT INTO app_user DEFAULT VALUES RETURNING user_id", Long.class);
    }

    private static String hash() {
        return (UUID.randomUUID().toString() + UUID.randomUUID()).replace("-", "");
    }
}
