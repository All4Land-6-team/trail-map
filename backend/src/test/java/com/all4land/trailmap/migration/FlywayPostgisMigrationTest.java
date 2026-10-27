package com.all4land.trailmap.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.sql.DriverManager;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers(disabledWithoutDocker = true)
class FlywayPostgisMigrationTest {

    private static final DockerImageName POSTGIS_IMAGE = DockerImageName
            .parse("pgrouting/pgrouting:16-3.5-3.8")
            .asCompatibleSubstituteFor("postgres");

    @Container
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("trail_map")
            .withUsername("postgres")
            .withPassword("postgres");

    @Test
    void Flyway는_PostGIS와_핵심_스키마를_실제_PostgreSQL에_적용한다() throws Exception {
        Flyway flyway = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .validateOnMigrate(true)
                .load();

        var result = flyway.migrate();

        assertThat(result.success).isTrue();
        assertThat(result.targetSchemaVersion).isEqualTo("4");

        try (var connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()
        )) {
            assertThat(queryForInt(connection, """
                    SELECT count(*)
                    FROM pg_extension
                    WHERE extname = 'postgis'
                    """)).isEqualTo(1);

            assertThat(queryForInt(connection, """
                    SELECT count(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_type = 'BASE TABLE'
                      AND table_name NOT IN ('flyway_schema_history', 'spatial_ref_sys')
                    """)).isEqualTo(16);

            assertThat(queryForInt(connection, """
                    SELECT count(*)
                    FROM pg_constraint constraint_definition
                    JOIN pg_namespace namespace ON namespace.oid = constraint_definition.connamespace
                    WHERE namespace.nspname = 'public'
                      AND constraint_definition.contype = 'f'
                    """)).isEqualTo(38);

            assertThat(queryForSet(connection, """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'app_user'
                    """)).containsExactlyInAnyOrder("user_id", "nickname", "created_at", "updated_at");

            assertThat(queryForSet(connection, """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'spot_vote'
                    """)).containsExactlyInAnyOrder(
                    "vote_id", "user_id", "spot_id", "facility_id", "vote_type", "created_at", "updated_at"
            );

            assertThat(queryForInt(connection, """
                    SELECT count(*)
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND indexdef ILIKE '%USING gist%'
                    """)).isEqualTo(7);

            try (var statement = connection.createStatement()) {
                statement.executeUpdate("INSERT INTO app_user (nickname) VALUES ('산길친구'), ('산길친구'), (NULL)");
                assertThatThrownBy(() -> statement.executeUpdate("INSERT INTO app_user (nickname) VALUES ('   ')"))
                        .hasMessageContaining("chk_app_user_nickname_not_blank");
            }
        }
    }

    private int queryForInt(java.sql.Connection connection, String sql) throws Exception {
        try (var statement = connection.createStatement(); var resultSet = statement.executeQuery(sql)) {
            resultSet.next();
            return resultSet.getInt(1);
        }
    }

    private Set<String> queryForSet(java.sql.Connection connection, String sql) throws Exception {
        try (var statement = connection.createStatement(); var resultSet = statement.executeQuery(sql)) {
            var values = new java.util.HashSet<String>();
            while (resultSet.next()) {
                values.add(resultSet.getString(1));
            }
            return values;
        }
    }
}
