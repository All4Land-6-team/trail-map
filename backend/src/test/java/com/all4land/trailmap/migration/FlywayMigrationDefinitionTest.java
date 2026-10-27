package com.all4land.trailmap.migration;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class FlywayMigrationDefinitionTest {

    private static final String[] CORE_TABLES = {
            "data_source",
            "app_user",
            "saved_course",
            "mountain",
            "course",
            "course_analysis",
            "facility",
            "hike_schedule",
            "hike_record",
            "mountain_review",
            "course_review",
            "user_spot",
            "spot_review",
            "facility_report",
            "photo"
    };

    @Test
    void 첫_마이그레이션은_PostGIS_확장을_활성화한다() throws IOException {
        String migration = readMigration("db/migration/V1__enable_postgis.sql");

        assertThat(migration).containsIgnoringCase("CREATE EXTENSION IF NOT EXISTS postgis");
    }

    @Test
    void 두_번째_마이그레이션은_모든_핵심_테이블을_생성한다() throws IOException {
        String migration = readMigration("db/migration/V2__create_core_schema.sql");

        for (String table : CORE_TABLES) {
            assertThat(migration).containsPattern("(?im)^CREATE TABLE\\s+" + table + "\\s*\\(");
        }
    }

    @Test
    void 익명_사용자는_닉네임만_선택적으로_저장한다() throws IOException {
        String migration = readMigration("db/migration/V2__create_core_schema.sql");
        String appUserDefinition = migration.substring(
                migration.indexOf("CREATE TABLE app_user"),
                migration.indexOf("CREATE TABLE mountain")
        );

        assertThat(appUserDefinition)
                .contains("nickname VARCHAR(100)")
                .doesNotContain("display_name", "auth_provider", "auth_subject", "deleted_at", "UNIQUE (nickname)");
    }

    @Test
    void 핵심_공간_인덱스와_부분_유일_인덱스를_정의한다() throws IOException {
        String migration = readMigration("db/migration/V2__create_core_schema.sql");

        assertThat(migration)
                .contains("USING GIST (mountain_display_location)")
                .contains("USING GIST (course_geometry)")
                .contains("CREATE UNIQUE INDEX uq_saved_course_active")
                .contains("CREATE UNIQUE INDEX uq_hike_schedule_day")
                .contains("CREATE UNIQUE INDEX uq_hike_record_active_user")
                .contains("CREATE UNIQUE INDEX uq_facility_report_active");
    }

    @Test
    void 세_번째_마이그레이션은_커뮤니티_후기와_스팟_구조를_확장한다() throws IOException {
        String migration = readMigration("db/migration/V3__support_community_reviews_and_spots.sql");

        assertThat(migration)
                .contains("ADD COLUMN hike_record_id BIGINT")
                .contains("CHECK (rating BETWEEN 1 AND 5)")
                .contains("CHECK (length(review_content) <= 1000)")
                .contains("'RESTROOM'")
                .contains("CHECK (num_nonnulls(spot_id, facility_id) = 1)")
                .containsPattern("(?im)^CREATE TABLE\\s+spot_vote\\s*\\(")
                .contains("CHECK (vote_type IN ('YES', 'NO'))")
                .contains("UNIQUE (user_id, spot_id)")
                .contains("UNIQUE (user_id, facility_id)");
    }

    @Test
    void 네_번째_마이그레이션은_등산_기록에_GPS_이동_경로를_추가한다() throws IOException {
        String migration = readMigration("db/migration/V4__add_hike_record_traveled_path.sql");

        assertThat(migration)
                .contains("ALTER TABLE hike_record")
                .contains("ADD COLUMN traveled_path geometry(LineString, 4326)")
                .contains("ST_NPoints(traveled_path) >= 2");
    }

    private String readMigration(String path) throws IOException {
        try (var inputStream = getClass().getClassLoader().getResourceAsStream(path)) {
            assertThat(inputStream).as("migration resource %s", path).isNotNull();
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
