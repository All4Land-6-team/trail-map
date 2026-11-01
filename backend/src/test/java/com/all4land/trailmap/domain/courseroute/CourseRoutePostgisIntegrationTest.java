package com.all4land.trailmap.domain.courseroute;

import com.all4land.trailmap.domain.courseroute.exception.CourseRouteException;
import com.all4land.trailmap.domain.courseroute.repository.CourseRouteRepository;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteDocumentReader;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteImportService;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.Path;
import java.util.UUID;
import static com.all4land.trailmap.domain.courseroute.RouteTestDocuments.*;
import static org.assertj.core.api.Assertions.*;

/** Uses an isolated transactional schema; every test schema and row is rolled back. */
@EnabledIfEnvironmentVariable(named = "ROUTE_TEST_JDBC_URL", matches = "jdbc:postgresql:.*")
class CourseRoutePostgisIntegrationTest {
    @TempDir Path directory;
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void importsThirteenOnceQueriesGeometryAndRejectsChangesWithoutOverwriting() throws Exception {
        var dataSource = new DriverManagerDataSource(System.getenv("ROUTE_TEST_JDBC_URL"),
                System.getenv().getOrDefault("ROUTE_TEST_DB_USERNAME", "postgres"),
                System.getenv().getOrDefault("ROUTE_TEST_DB_PASSWORD", System.getenv().getOrDefault("DB_PASSWORD", "")));
        var jdbc = new JdbcTemplate(dataSource);
        var template = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        var document = document(mapper);
        Path file = write(mapper, directory, document);
        template.executeWithoutResult(transaction -> {
            transaction.setRollbackOnly();
            String schema = "route_test_" + UUID.randomUUID().toString().replace("-", "");
            jdbc.execute("CREATE SCHEMA " + schema);
            jdbc.execute("SET LOCAL search_path TO " + schema + ", public");
            var connection = DataSourceUtils.getConnection(dataSource);
            for (String migration : new String[]{"V2__create_core_schema.sql", "V3__support_community_reviews_and_spots.sql",
                    "V4__add_hike_record_traveled_path.sql", "V5__add_course_route_catalog.sql"}) {
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/" + migration));
            }
            long sourceId = jdbc.queryForObject("INSERT INTO data_source (source_name, source_format) VALUES ('test', 'TEST') RETURNING source_id", Long.class);
            long bukhansan = mountain(jdbc, sourceId, "북한산");
            long dobongsan = mountain(jdbc, sourceId, "도봉산");
            var repository = new CourseRouteRepository(jdbc, mapper);
            var importer = new CourseRouteImportService(new CourseRouteDocumentReader(mapper), repository);
            var service = new CourseRouteService(repository);
            var first = importer.importFile(file, bukhansan, dobongsan);
            assertThat(first.inserted()).isEqualTo(13);
            var replay = importer.importFile(file, bukhansan, dobongsan);
            assertThat(replay.inserted()).isZero(); assertThat(replay.existing()).isEqualTo(13);
            assertThat(replay.sourceId()).isEqualTo(first.sourceId());
            assertThat(service.getCatalog("bukhansan")).hasSize(8);
            assertThat(service.getCatalog("dobongsan")).hasSize(5);
            var route = service.getCatalog("bukhansan").getFirst();
            assertThat(route.geometry().coordinates()).hasSize(3);
            assertThat(route.distanceMeters()).isBetween(200.0, 400.0);
            assertThat(route.difficulty()).isNull(); assertThat(route.durationSeconds()).isNull();
            assertThat(route.source().validationStatus()).isEqualTo("candidate_smap_unverified");
            assertThat(service.getRoute(route.courseId())).isEqualTo(route);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM course_analysis", Integer.class)).isZero();
            assertThatThrownBy(() -> importer.importFile(file, dobongsan, bukhansan)).isInstanceOf(CourseRouteException.class);
            ((ObjectNode) document.path("features").get(0).path("properties")).put("check_note", "changed");
            try { write(mapper, directory, document); } catch (java.io.IOException error) { throw new RuntimeException(error); }
            assertThatThrownBy(() -> importer.importFile(file, bukhansan, dobongsan)).isInstanceOf(CourseRouteException.class);
            assertThat(service.getRoute(route.courseId())).isEqualTo(route);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM course", Integer.class)).isEqualTo(13);
        });
    }

    private static long mountain(JdbcTemplate jdbc, long sourceId, String name) {
        return jdbc.queryForObject("""
                INSERT INTO mountain (mountain_name, mountain_display_location, source_id, source_record_id, source_hash, imported_at)
                VALUES (?, ST_SetSRID(ST_MakePoint(127, 37.7), 4326), ?, ?, repeat('a',64), CURRENT_TIMESTAMP)
                RETURNING mountain_id
                """, Long.class, name, sourceId, name);
    }
}
