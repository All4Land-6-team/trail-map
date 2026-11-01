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
                    "V4__add_hike_record_traveled_path.sql", "V5__prevent_duplicate_community_reviews.sql",
                    "V6__add_community_spot_request_id.sql", "V7__add_course_route_catalog.sql", "V8__add_course_guide_metadata.sql"}) {
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
            // Guide import must leave candidate geometry/version and its original replay intact.
            var guideRepository = new com.all4land.trailmap.domain.courseroute.repository.CourseGuideRepository(jdbc);
            var reader = new CourseRouteDocumentReader(mapper);
            Path restored;
            try { restored = write(mapper, directory, document(mapper)); } catch (java.io.IOException e) { throw new RuntimeException(e); }
            var originalRoutes = reader.read(restored).routes();
            var invalidGuides = CourseGuideDocumentReaderTest.guideDocument(mapper);
            for (int i = 0; i < 12; i++) ((ObjectNode) invalidGuides.path("courses").get(i)).put("routeHash", originalRoutes.get(i).hash());
            Path invalidFile = directory.resolve("invalid-guide.json");
            try { mapper.writeValue(invalidFile.toFile(), invalidGuides); } catch (java.io.IOException e) { throw new RuntimeException(e); }
            var guideService = new com.all4land.trailmap.domain.courseroute.service.CourseGuideImportService(
                    new com.all4land.trailmap.domain.courseroute.service.CourseGuideDocumentReader(mapper), guideRepository, repository);
            var nested = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
            nested.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_NESTED);
            assertThatThrownBy(() -> nested.execute(status -> guideService.importFile(invalidFile)))
                    .isInstanceOf(IllegalStateException.class);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM course_guide_metadata", Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM course WHERE official_duration_seconds IS NOT NULL", Integer.class)).isZero();
            for (var original : originalRoutes) {
                String officialId = "121500V%03d".formatted(original.order());
                var guide = new com.all4land.trailmap.domain.courseroute.service.CourseGuideDocumentReader.Guide(
                        original.recordId(), original.mountainKey(), original.hash(), officialId, original.via(),
                        "하", 2000, 5400, "https://www.knps.or.kr/front/portal/visit/visitCourseSubMain.do?menuNo=8000275&parkId=121500&parkNavGb=guide&vcursId=" + officialId, "2026-11-01");
                assertThat(guideRepository.importGuide(CourseRouteImportService.DATASET_KEY, guide, "b".repeat(64))).isTrue();
                assertThat(guideRepository.importGuide(CourseRouteImportService.DATASET_KEY, guide, "b".repeat(64))).isFalse();
                assertThatThrownBy(() -> guideRepository.importGuide(CourseRouteImportService.DATASET_KEY, guide, "c".repeat(64)))
                        .isInstanceOf(IllegalStateException.class);
            }
            assertThat(importer.importFile(restored, bukhansan, dobongsan).existing()).isEqualTo(13);
            var enriched = service.getRoute(route.courseId());
            assertThat(enriched.guide().difficultyGrade()).isEqualTo("하");
            assertThat(enriched.difficulty()).isEqualTo("BEGINNER");
            assertThat(enriched.durationSeconds()).isEqualTo(5400);
            assertThat(enriched.geometry()).isEqualTo(route.geometry());
            assertThat(jdbc.queryForObject("SELECT count(*) FROM course_guide_metadata", Integer.class)).isEqualTo(13);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM course_analysis", Integer.class)).isZero();
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
