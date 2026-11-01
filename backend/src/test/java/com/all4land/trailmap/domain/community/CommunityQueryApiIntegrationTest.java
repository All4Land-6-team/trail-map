package com.all4land.trailmap.domain.community;

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
import com.jayway.jsonpath.JsonPath;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.containsString;

/** 실제 PostgreSQL + PostGIS에서 공식 시설과 사용자 스팟 통합 조회를 검증한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class CommunityQueryApiIntegrationTest {

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
    long sourceId;
    long mountainId;
    long courseId;
    long facilityId;
    long userSpotId;
    long facilityReviewId;

    @BeforeEach
    void setUp() {
        userId = insertUser("산길친구");
        otherUserId = insertUser(null);
        sourceId = jdbcTemplate.queryForObject("""
                INSERT INTO data_source (source_name, source_url, source_format)
                VALUES ('국립공원공단', 'https://example.test/facilities', 'CSV')
                RETURNING source_id
                """, Long.class);
        mountainId = jdbcTemplate.queryForObject("""
                INSERT INTO mountain (mountain_name, mountain_display_location, source_id, source_record_id, source_hash, imported_at)
                VALUES ('북한산', ST_SetSRID(ST_MakePoint(126.98, 37.66), 4326), ?, 'bukhansan', ?, now())
                RETURNING mountain_id
                """, Long.class, sourceId, hash());
        courseId = jdbcTemplate.queryForObject("""
                INSERT INTO course (mountain_id, course_name, course_geometry, source_id, source_record_id, source_hash, imported_at)
                VALUES (?, '백운대 코스', ST_GeomFromText('LINESTRING(126.97 37.65, 126.99 37.67)', 4326), ?, 'bukhansan-baegundae', ?, now())
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
                VALUES (?, ?, 'DRINKING_FOUNTAIN',
                        ST_SetSRID(ST_MakePoint(126.982, 37.662), 4326), '능선 샘터', 'COMMUNITY_VERIFIED')
                RETURNING spot_id
                """, Long.class, userId, mountainId);
        jdbcTemplate.update("""
                INSERT INTO user_spot (user_id, mountain_id, spot_type, spot_location, spot_name, spot_status)
                VALUES (?, ?, 'REST_AREA',
                        ST_SetSRID(ST_MakePoint(126.983, 37.663), 4326), '숨겨진 쉼터', 'HIDDEN')
                """, userId, mountainId);

        jdbcTemplate.update(
                "INSERT INTO spot_vote (user_id, facility_id, vote_type) VALUES (?, ?, 'YES')",
                userId, facilityId
        );
        jdbcTemplate.update(
                "INSERT INTO spot_vote (user_id, facility_id, vote_type) VALUES (?, ?, 'NO')",
                otherUserId, facilityId
        );
        jdbcTemplate.update(
                "INSERT INTO spot_vote (user_id, spot_id, vote_type) VALUES (?, ?, 'NO')",
                userId, userSpotId
        );
        facilityReviewId = jdbcTemplate.queryForObject("""
                INSERT INTO spot_review (user_id, facility_id, review_content, visited_date)
                VALUES (?, ?, '깨끗하게 관리되고 있어요.', CURRENT_DATE)
                RETURNING review_id
                """, Long.class, otherUserId, facilityId);
        jdbcTemplate.update("""
                INSERT INTO spot_review (user_id, spot_id, review_content, visited_date)
                VALUES (?, ?, '물이 잘 나와요.', CURRENT_DATE)
                """, otherUserId, userSpotId);
        insertPhoto("facility/%d/direct.webp".formatted(facilityId), "facility_id", facilityId);
        insertPhoto("facility/%d/review.webp".formatted(facilityId), "spot_review_id", facilityReviewId);
    }

    @Test
    void 커뮤니티_산과_코스_목록을_지도_좌표와_함께_조회한다() throws Exception {
        long courseReviewId = jdbcTemplate.queryForObject("""
                INSERT INTO course_review (user_id, course_id, review_content, visited_date)
                VALUES (?, ?, '대표 사진이 있는 코스 후기', CURRENT_DATE)
                RETURNING review_id
                """, Long.class, userId, courseId);
        insertPhoto("course/%d/representative.webp".formatted(courseReviewId), "course_review_id", courseReviewId);

        mockMvc.perform(asUser(get("/v1/community/mountains")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].mountainId").value(mountainId))
                .andExpect(jsonPath("$.data[0].externalId").value("bukhansan"))
                .andExpect(jsonPath("$.data[0].longitude").value(126.98))
                .andExpect(jsonPath("$.data[0].latitude").value(37.66));

        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/courses")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].courseId").value(courseId))
                .andExpect(jsonPath("$.data[0].externalId").value("bukhansan-baegundae"))
                .andExpect(jsonPath("$.data[0].reviewCount").value(1))
                .andExpect(jsonPath("$.data[0].photoCount").value(1))
                .andExpect(jsonPath("$.data[0].representativePhotoUrl", containsString(
                        "course/%d/representative.webp".formatted(courseReviewId)
                )))
                .andExpect(jsonPath("$.data[0].coordinates.length()").value(2))
                .andExpect(jsonPath("$.data[0].coordinates[0].longitude").value(126.97))
                .andExpect(jsonPath("$.data[0].coordinates[1].latitude").value(37.67));
    }

    @Test
    void 지도_영역에서_공식_시설과_숨김이_아닌_사용자_스팟을_함께_조회한다() throws Exception {
        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots"))
                        .param("west", "126.97")
                        .param("south", "37.65")
                        .param("east", "126.99")
                        .param("north", "37.67"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].targetType").value("FACILITY"))
                .andExpect(jsonPath("$.data[0].type").value("RESTROOM"))
                .andExpect(jsonPath("$.data[0].official").doesNotExist())
                .andExpect(jsonPath("$.data[0].yesVotes").value(1))
                .andExpect(jsonPath("$.data[0].noVotes").value(1))
                .andExpect(jsonPath("$.data[0].viewerVote").value("YES"))
                .andExpect(jsonPath("$.data[0].reviewCount").value(1))
                .andExpect(jsonPath("$.data[0].photoCount").value(2))
                .andExpect(jsonPath("$.data[1].targetType").value("USER_SPOT"))
                .andExpect(jsonPath("$.data[1].type").value("DRINKING_FOUNTAIN"))
                .andExpect(jsonPath("$.data[1].viewerVote").value("NO"));

        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots/map"))
                        .param("west", "126.97").param("south", "37.65")
                        .param("east", "126.99").param("north", "37.67"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].targetType").value("FACILITY"))
                .andExpect(jsonPath("$.data[0].reviewCount").doesNotExist())
                .andExpect(jsonPath("$.data[0].photoCount").doesNotExist());
    }

    @Test
    void 산_전체_스팟_목록은_지도_영역과_무관하게_커서로_이어_조회한다() throws Exception {
        jdbcTemplate.update("UPDATE spot_review SET created_at = '2026-10-30T09:00:00Z' WHERE facility_id = ?", facilityId);
        jdbcTemplate.update("UPDATE spot_review SET created_at = '2026-10-31T09:00:00Z' WHERE spot_id = ?", userSpotId);
        var first = mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots/list")
                        .param("size", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].targetType").value("USER_SPOT"))
                .andExpect(jsonPath("$.data.hasNext").value(true))
                .andReturn();
        String cursor = JsonPath.read(first.getResponse().getContentAsString(), "$.data.nextCursor");
        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots/list")
                        .param("size", "1").param("cursor", cursor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].targetType").value("FACILITY"))
                .andExpect(jsonPath("$.data.hasNext").value(false));
        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots/list")
                        .param("size", "1").param("type", "RESTROOM").param("cursor", cursor)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 지도_영역과_스팟_종류로_필터링한다() throws Exception {
        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots"))
                        .param("west", "126.9805")
                        .param("south", "37.6605")
                        .param("east", "126.9825")
                        .param("north", "37.6625")
                        .param("type", "DRINKING_FOUNTAIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].targetId").value(userSpotId));

        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots"))
                        .param("west", "126.0")
                        .param("south", "37.0")
                        .param("east", "126.5")
                        .param("north", "37.5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void 공식_음수대는_커뮤니티_물_스팟으로_조회한다() throws Exception {
        long drinkingWaterId = jdbcTemplate.queryForObject("""
                INSERT INTO facility (mountain_id, facility_name, facility_type, facility_location,
                                      official_status, source_id, source_hash, imported_at)
                VALUES (?, '백운대 샘터', 'DRINKING_WATER',
                        ST_SetSRID(ST_MakePoint(126.984, 37.664), 4326), 'AVAILABLE', ?, ?, now())
                RETURNING facility_id
                """, Long.class, mountainId, sourceId, hash());

        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots"))
                        .param("west", "126.98")
                        .param("south", "37.66")
                        .param("east", "126.99")
                        .param("north", "37.67")
                        .param("type", "DRINKING_FOUNTAIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].targetType").value("FACILITY"))
                .andExpect(jsonPath("$.data[0].targetId").value(drinkingWaterId))
                .andExpect(jsonPath("$.data[0].type").value("DRINKING_FOUNTAIN"))
                .andExpect(jsonPath("$.data[0].official").doesNotExist());
    }

    @Test
    void 공식_시설_상세에서_출처와_집계값을_조회한다() throws Exception {
        mockMvc.perform(asUser(get("/v1/community/mountains/%d/spots/FACILITY/%d"
                        .formatted(mountainId, facilityId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("백운탐방지원센터 화장실"))
                .andExpect(jsonPath("$.data.sourceName").value("국립공원공단"))
                .andExpect(jsonPath("$.data.sourceUrl").value("https://example.test/facilities"))
                .andExpect(jsonPath("$.data.representativePhotoUrl", containsString(
                        "facility/%d/review.webp".formatted(facilityId)
                )));
    }

    @Test
    void 산_코스_스팟_후기를_조회하고_코스는_산행별_후기를_최신순으로_반환한다() throws Exception {
        long oldRecordId = insertCompletedHike("2026-10-20 01:00:00+00", "2026-10-20 04:00:00+00");
        long latestRecordId = insertCompletedHike("2026-10-21 01:00:00+00", "2026-10-21 04:00:00+00");
        long mountainReviewId = jdbcTemplate.queryForObject("""
                INSERT INTO mountain_review
                    (user_id, mountain_id, hike_record_id, review_content, visited_date, rating)
                VALUES (?, ?, ?, '경치가 좋아요.', DATE '2026-10-21', 5)
                RETURNING review_id
                """, Long.class, userId, mountainId, latestRecordId);
        jdbcTemplate.update("""
                INSERT INTO course_review
                    (user_id, course_id, hike_record_id, review_content, visited_date, created_at)
                VALUES (?, ?, ?, '예전 코스 후기', DATE '2026-10-20', TIMESTAMPTZ '2026-10-20 05:00:00+00'),
                       (?, ?, ?, '최근 코스 후기', DATE '2026-10-21', TIMESTAMPTZ '2026-10-21 05:00:00+00')
                """, userId, courseId, oldRecordId, userId, courseId, latestRecordId);
        insertPhoto("mountain/%d/review.webp".formatted(mountainReviewId), "mountain_review_id", mountainReviewId);
        insertPhoto("mountain/%d/review-2.webp".formatted(mountainReviewId), "mountain_review_id", mountainReviewId);

        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/reviews")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].kind").value("MOUNTAIN"))
                .andExpect(jsonPath("$.data[0].author").value("산길친구"))
                .andExpect(jsonPath("$.data[0].rating").value(5.0))
                .andExpect(jsonPath("$.data[0].photoUrls[0]", containsString(
                        "mountain/%d/review.webp".formatted(mountainReviewId)
                )));

        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/preview")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.summary.reviewCount").value(1))
                .andExpect(jsonPath("$.data.reviews.length()").value(1))
                .andExpect(jsonPath("$.data.photos.length()").value(2));

        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/photos")
                        .param("limit", "1").param("offset", "0")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].reviewRating").value(5.0));
        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/photos")
                        .param("limit", "1").param("offset", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        mockMvc.perform(asUser(get("/v1/community/courses/" + courseId + "/reviews")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].content").value("최근 코스 후기"))
                .andExpect(jsonPath("$.data[0].hikeRecordId").value(latestRecordId))
                .andExpect(jsonPath("$.data[1].content").value("예전 코스 후기"))
                .andExpect(jsonPath("$.data[1].hikeRecordId").value(oldRecordId));

        mockMvc.perform(asUser(get("/v1/community/courses/" + courseId + "/preview")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviews[0].content").value("최근 코스 후기"))
                .andExpect(jsonPath("$.data.photos").isArray());

        mockMvc.perform(asUser(get("/v1/community/mountains/%d/spots/FACILITY/%d/reviews"
                        .formatted(mountainId, facilityId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].kind").value("SPOT"))
                .andExpect(jsonPath("$.data[0].author").value("익명" + otherUserId))
                .andExpect(jsonPath("$.data[0].photoUrls[0]", containsString(
                        "facility/%d/review.webp".formatted(facilityId)
                )));

        mockMvc.perform(asUser(get("/v1/community/mountains/%d/spots/FACILITY/%d/preview"
                        .formatted(mountainId, facilityId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviews[0].kind").value("SPOT"))
                .andExpect(jsonPath("$.data.photos").isArray());
    }

    @Test
    void 잘못된_영역과_없는_대상은_오류로_응답한다() throws Exception {
        mockMvc.perform(asUser(get("/v1/community/mountains/" + mountainId + "/spots"))
                        .param("west", "127")
                        .param("south", "38")
                        .param("east", "126")
                        .param("north", "37"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(asUser(get("/v1/community/mountains/%d/spots/FACILITY/%d"
                        .formatted(mountainId, Long.MAX_VALUE))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMUNITY_404_4"));
    }

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder request) {
        return request.header("X-User-Id", userId);
    }

    private long insertUser(String nickname) {
        return jdbcTemplate.queryForObject(
                "INSERT INTO app_user (nickname) VALUES (?) RETURNING user_id",
                Long.class,
                nickname
        );
    }

    private long insertCompletedHike(String startedAt, String endedAt) {
        long scheduleId = jdbcTemplate.queryForObject("""
                INSERT INTO hike_schedule (user_id, course_id, scheduled_starts_at)
                VALUES (?, ?, CAST(? AS timestamptz))
                RETURNING schedule_id
                """, Long.class, userId, courseId, startedAt);
        return jdbcTemplate.queryForObject("""
                INSERT INTO hike_record
                    (schedule_id, user_id, course_id, course_version, recorded_course_geometry,
                     started_at, ended_at, hike_status)
                VALUES (?, ?, ?, 1,
                        ST_GeomFromText('LINESTRING(126.97 37.65, 126.99 37.67)', 4326),
                        CAST(? AS timestamptz), CAST(? AS timestamptz), 'COMPLETED')
                RETURNING hike_record_id
                """, Long.class, scheduleId, userId, courseId, startedAt, endedAt);
    }

    private void insertPhoto(String objectKey, String targetColumn, long targetId) {
        String sql = """
                INSERT INTO photo
                    (user_id, %s, object_key, original_file_name, media_type, file_size_bytes)
                VALUES (?, ?, ?, 'photo.webp', 'image/webp', 1024)
                """.formatted(targetColumn);
        jdbcTemplate.update(sql, userId, targetId, objectKey);
    }

    private static String hash() {
        return (UUID.randomUUID().toString() + UUID.randomUUID()).replace("-", "");
    }
}
