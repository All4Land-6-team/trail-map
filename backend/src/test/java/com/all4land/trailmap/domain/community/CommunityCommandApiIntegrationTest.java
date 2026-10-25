package com.all4land.trailmap.domain.community;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 실제 PostgreSQL + PostGIS에서 후기 작성 자격과 사용자 스팟 등록 정책을 검증한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class CommunityCommandApiIntegrationTest {

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
    long sourceId;
    long mountainId;
    long courseId;
    long facilityId;
    long userSpotId;

    @BeforeEach
    void setUp() {
        userId = jdbcTemplate.queryForObject(
                "INSERT INTO app_user (nickname) VALUES ('산길친구') RETURNING user_id",
                Long.class
        );
        sourceId = jdbcTemplate.queryForObject("""
                INSERT INTO data_source (source_name, source_url, source_format)
                VALUES ('국립공원공단', 'https://example.test/facilities', 'CSV')
                RETURNING source_id
                """, Long.class);
        mountainId = jdbcTemplate.queryForObject("""
                INSERT INTO mountain (mountain_name, mountain_display_location, source_id, source_hash, imported_at)
                VALUES ('북한산', ST_SetSRID(ST_MakePoint(126.98, 37.66), 4326), ?, ?, now())
                RETURNING mountain_id
                """, Long.class, sourceId, hash());
        courseId = jdbcTemplate.queryForObject("""
                INSERT INTO course (mountain_id, course_name, course_geometry, source_id, source_hash, imported_at)
                VALUES (?, '백운대 코스', ST_GeomFromText('LINESTRING(126.97 37.65, 126.99 37.67)', 4326), ?, ?, now())
                RETURNING course_id
                """, Long.class, mountainId, sourceId, hash());
        facilityId = jdbcTemplate.queryForObject("""
                INSERT INTO facility (mountain_id, facility_name, facility_type, facility_location,
                                      official_status, source_id, source_hash, imported_at)
                VALUES (?, '백운탐방지원센터 화장실', 'TOILET',
                        ST_SetSRID(ST_MakePoint(126.981, 37.661), 4326), 'AVAILABLE', ?, ?, now())
                RETURNING facility_id
                """, Long.class, mountainId, sourceId, hash());
        userSpotId = jdbcTemplate.queryForObject("""
                INSERT INTO user_spot (user_id, mountain_id, spot_type, spot_location, spot_name, spot_status)
                VALUES (?, ?, 'REST_AREA', ST_SetSRID(ST_MakePoint(126.982, 37.662), 4326),
                        '능선 쉼터', 'PENDING')
                RETURNING spot_id
                """, Long.class, userId, mountainId);
    }

    @Test
    void 최근_24시간_내_코스별_최신_완료_산행만_후기_자격으로_반환한다() throws Exception {
        insertCompletedHike(courseId, 30);
        long previousId = insertCompletedHike(courseId, 8);
        long latestId = insertCompletedHike(courseId, 2);

        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/review-eligibility")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.eligible").value(true))
                .andExpect(jsonPath("$.data.hikes.length()").value(1))
                .andExpect(jsonPath("$.data.hikes[0].hikeRecordId").value(latestId))
                .andExpect(jsonPath("$.data.hikes[0].courseId").value(courseId));

        assertThat(previousId).isNotEqualTo(latestId);
    }

    @Test
    void 자격이_있는_산행으로_산_코스_공식시설_후기를_등록한다() throws Exception {
        long hikeRecordId = insertCompletedHike(courseId, 2);

        mockMvc.perform(asUser(post("/v1/community/mountains/" + mountainId + "/reviews"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewJson(hikeRecordId, " 경치가 좋아요. ", 5)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.kind").value("MOUNTAIN"))
                .andExpect(jsonPath("$.data.content").value("경치가 좋아요."))
                .andExpect(jsonPath("$.data.rating").value(5.0));

        mockMvc.perform(asUser(post("/v1/community/courses/" + courseId + "/reviews"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewJson(hikeRecordId, "코스 상태가 좋아요.", null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.kind").value("COURSE"));

        mockMvc.perform(asUser(post("/v1/community/mountains/%d/spots/FACILITY/%d/reviews"
                                .formatted(mountainId, facilityId)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewJson(hikeRecordId, "시설이 깨끗해요.", null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.kind").value("SPOT"));

        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM mountain_review", Integer.class)).isPositive();
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM course_review", Integer.class)).isPositive();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM spot_review WHERE facility_id = ?", Integer.class, facilityId
        )).isEqualTo(1);
    }

    @Test
    void 만료된_산행과_대상에_맞지_않는_평점은_거부한다() throws Exception {
        long expiredHikeId = insertCompletedHike(courseId, 30);

        mockMvc.perform(asUser(post("/v1/community/mountains/" + mountainId + "/reviews"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewJson(expiredHikeId, "늦은 후기", 5)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("COMMUNITY_403_1"));

        long eligibleHikeId = insertCompletedHike(courseId, 2);
        mockMvc.perform(asUser(post("/v1/community/courses/" + courseId + "/reviews"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewJson(eligibleHikeId, "평점은 코스 후기에 없음", 4)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMUNITY_400_1"));
    }

    @Test
    void 같은_유형의_30m_중복을_알리고_명시적_확인_후_스팟을_등록한다() throws Exception {
        long hikeRecordId = insertCompletedHike(courseId, 2);

        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots/duplicates"))
                        .param("type", "RESTROOM")
                        .param("longitude", "126.9811")
                        .param("latitude", "37.661"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].targetType").value("FACILITY"))
                .andExpect(jsonPath("$.data[0].distanceMeters").value(org.hamcrest.Matchers.lessThan(30.0)));

        String unconfirmed = spotJson(hikeRecordId, false);
        mockMvc.perform(asUser(post("/v1/community/mountains/" + mountainId + "/spots"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(unconfirmed))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_409_1"));

        mockMvc.perform(asUser(post("/v1/community/mountains/" + mountainId + "/spots"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(spotJson(hikeRecordId, true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.type").value("RESTROOM"))
                .andExpect(jsonPath("$.data.status").value("PENDING"));

        assertThat(jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM user_spot
                WHERE user_id = ?
                  AND hike_record_id = ?
                  AND spot_type = 'RESTROOM'
                  AND ST_X(spot_location) = 126.9811
                """, Integer.class, userId, hikeRecordId)).isEqualTo(1);
    }

    @Test
    void 스팟_평가는_사용자별_한_건으로_등록_변경_취소된다() throws Exception {
        String voteUrl = "/v1/community/mountains/%d/spots/USER_SPOT/%d/vote"
                .formatted(mountainId, userSpotId);

        mockMvc.perform(asUser(put(voteUrl))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"voteType\":\"YES\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.yesVotes").value(1))
                .andExpect(jsonPath("$.data.noVotes").value(0))
                .andExpect(jsonPath("$.data.viewerVote").value("YES"));

        mockMvc.perform(asUser(put(voteUrl))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"voteType\":\"NO\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.yesVotes").value(0))
                .andExpect(jsonPath("$.data.noVotes").value(1))
                .andExpect(jsonPath("$.data.viewerVote").value("NO"));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM spot_vote WHERE user_id = ? AND spot_id = ?",
                Integer.class, userId, userSpotId
        )).isEqualTo(1);

        mockMvc.perform(asUser(delete(voteUrl)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.yesVotes").value(0))
                .andExpect(jsonPath("$.data.noVotes").value(0))
                .andExpect(jsonPath("$.data.viewerVote").doesNotExist());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM spot_vote WHERE user_id = ? AND spot_id = ?",
                Integer.class, userId, userSpotId
        )).isZero();
    }

    @Test
    void 사용자_스팟은_부정_평가_3건에_숨겨지고_평가가_바뀌면_다시_노출된다() throws Exception {
        long secondUserId = insertUser("둘째");
        long thirdUserId = insertUser("셋째");
        String voteUrl = "/v1/community/mountains/%d/spots/USER_SPOT/%d/vote"
                .formatted(mountainId, userSpotId);

        castVote(userId, voteUrl, "NO").andExpect(jsonPath("$.data.hidden").value(false));
        castVote(secondUserId, voteUrl, "NO").andExpect(jsonPath("$.data.hidden").value(false));
        castVote(thirdUserId, voteUrl, "NO")
                .andExpect(jsonPath("$.data.noVotes").value(3))
                .andExpect(jsonPath("$.data.status").value("HIDDEN"))
                .andExpect(jsonPath("$.data.hidden").value(true));

        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots"))
                        .param("west", "126.97")
                        .param("south", "37.65")
                        .param("east", "126.99")
                        .param("north", "37.67"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].targetType").value("FACILITY"));

        castVote(userId, voteUrl, "YES")
                .andExpect(jsonPath("$.data.yesVotes").value(1))
                .andExpect(jsonPath("$.data.noVotes").value(2))
                .andExpect(jsonPath("$.data.status").value("RECONFIRMATION_REQUIRED"))
                .andExpect(jsonPath("$.data.hidden").value(false));

        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots"))
                        .param("west", "126.97")
                        .param("south", "37.65")
                        .param("east", "126.99")
                        .param("north", "37.67"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    void 공식_시설은_부정_평가가_3건이어도_숨기지_않는다() throws Exception {
        long secondUserId = insertUser("둘째");
        long thirdUserId = insertUser("셋째");
        String voteUrl = "/v1/community/mountains/%d/spots/FACILITY/%d/vote"
                .formatted(mountainId, facilityId);

        castVote(userId, voteUrl, "NO");
        castVote(secondUserId, voteUrl, "NO");
        castVote(thirdUserId, voteUrl, "NO")
                .andExpect(jsonPath("$.data.noVotes").value(3))
                .andExpect(jsonPath("$.data.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.data.hidden").value(false));

        mockMvc.perform(asUser(get("/v1/community/mountains/%d/spots/FACILITY/%d"
                        .formatted(mountainId, facilityId))))
                .andExpect(status().isOk());
    }

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder request) {
        return request.header("X-User-Id", userId);
    }

    private org.springframework.test.web.servlet.ResultActions castVote(
            long voterId,
            String voteUrl,
            String voteType
    ) throws Exception {
        return mockMvc.perform(put(voteUrl)
                        .header("X-User-Id", voterId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"voteType\":\"%s\"}".formatted(voteType)))
                .andExpect(status().isOk());
    }

    private long insertUser(String nickname) {
        return jdbcTemplate.queryForObject(
                "INSERT INTO app_user (nickname) VALUES (?) RETURNING user_id",
                Long.class,
                nickname
        );
    }

    private long insertCompletedHike(long targetCourseId, int endedHoursAgo) {
        long scheduleId = jdbcTemplate.queryForObject("""
                INSERT INTO hike_schedule (user_id, course_id, scheduled_starts_at, deleted_at)
                VALUES (?, ?, now() - (? * interval '1 hour') - interval '2 hours', now())
                RETURNING schedule_id
                """, Long.class, userId, targetCourseId, endedHoursAgo);
        return jdbcTemplate.queryForObject("""
                INSERT INTO hike_record
                    (schedule_id, user_id, course_id, course_version, recorded_course_geometry,
                     started_at, ended_at, hike_status)
                VALUES (?, ?, ?, 1,
                        ST_GeomFromText('LINESTRING(126.97 37.65, 126.99 37.67)', 4326),
                        now() - (? * interval '1 hour') - interval '2 hours',
                        now() - (? * interval '1 hour'), 'COMPLETED')
                RETURNING hike_record_id
                """, Long.class, scheduleId, userId, targetCourseId, endedHoursAgo, endedHoursAgo);
    }

    private static String reviewJson(long hikeRecordId, String content, Integer rating) {
        String ratingJson = rating == null ? "null" : rating.toString();
        return """
                {"hikeRecordId":%d,"content":"%s","rating":%s}
                """.formatted(hikeRecordId, content, ratingJson);
    }

    private static String spotJson(long hikeRecordId, boolean confirmDistinct) {
        return """
                {
                  "hikeRecordId": %d,
                  "type": "RESTROOM",
                  "name": "새 화장실",
                  "longitude": 126.9811,
                  "latitude": 37.661,
                  "confirmDistinct": %s
                }
                """.formatted(hikeRecordId, confirmDistinct);
    }

    private static String hash() {
        return (UUID.randomUUID().toString() + UUID.randomUUID()).replace("-", "");
    }
}
