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

    private String readMigration(String path) throws IOException {
        try (var inputStream = getClass().getClassLoader().getResourceAsStream(path)) {
            assertThat(inputStream).as("migration resource %s", path).isNotNull();
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
