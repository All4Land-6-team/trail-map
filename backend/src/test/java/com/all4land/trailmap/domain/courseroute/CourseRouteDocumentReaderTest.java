package com.all4land.trailmap.domain.courseroute;

import com.all4land.trailmap.domain.courseroute.exception.CourseRouteException;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteDocumentReader;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import static com.all4land.trailmap.domain.courseroute.RouteTestDocuments.*;
import static org.assertj.core.api.Assertions.*;

class CourseRouteDocumentReaderTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final CourseRouteDocumentReader reader = new CourseRouteDocumentReader(mapper);
    @TempDir Path directory;

    @Test
    void normalizesOnlyConsecutiveDuplicatesAndPreservesBacktrackingAndProvenance() throws Exception {
        var result = reader.read(write(mapper, directory, document(mapper)));
        assertThat(result.routes()).hasSize(13);
        assertThat(result.routes().stream().filter(r -> "dobongsan".equals(r.mountainKey()))).hasSize(5);
        var route = result.routes().getFirst();
        assertThat(mapper.readTree(route.geometry()).path("coordinates")).hasSize(3);
        assertThat(route.status()).isEqualTo("candidate_smap_unverified");
        assertThat(route.officialMeters()).isEqualTo(2000);
        assertThat(route.via()).isEqualTo("시작~정상");
        assertThat(result.fileHash()).hasSize(64);
    }

    @Test
    void rejectsMissingOrDuplicateCourseIds() throws Exception {
        var root = document(mapper);
        ((ObjectNode) root.path("features").get(12).path("properties")).put("course_id", "BUKHAN_01");
        assertThatThrownBy(() -> reader.read(write(mapper, directory, root))).isInstanceOf(CourseRouteException.class);
        ((com.fasterxml.jackson.databind.node.ArrayNode) root.path("features")).remove(12);
        assertThatThrownBy(() -> reader.read(write(mapper, directory, root))).isInstanceOf(CourseRouteException.class);
    }

    @Test
    void rejectsWrongCrsInvalidCoordinatesAndNonLinestring() throws Exception {
        var root = document(mapper);
        root.putObject("crs").putObject("properties").put("name", "EPSG:5186");
        assertThatThrownBy(() -> reader.read(write(mapper, directory, root))).isInstanceOf(CourseRouteException.class);
        root.remove("crs");
        var geometry = (ObjectNode) root.path("features").get(0).path("geometry");
        geometry.putArray("coordinates").addArray().add(200000).add(500000);
        assertThatThrownBy(() -> reader.read(write(mapper, directory, root))).isInstanceOf(CourseRouteException.class);
        geometry.put("type", "MultiLineString");
        assertThatThrownBy(() -> reader.read(write(mapper, directory, root))).isInstanceOf(CourseRouteException.class);
    }

    @Test
    void rejectsThreeDimensionsDegenerateLinesAndUnverifiedStatusPromotion() throws Exception {
        var root = document(mapper);
        var points = (com.fasterxml.jackson.databind.node.ArrayNode) root.path("features").get(0).path("geometry").path("coordinates");
        ((com.fasterxml.jackson.databind.node.ArrayNode) points.get(0)).add(100);
        assertThatThrownBy(() -> reader.read(write(mapper, directory, root))).isInstanceOf(CourseRouteException.class);
        points.removeAll(); points.addArray().add(127).add(37); points.addArray().add(127).add(37);
        assertThatThrownBy(() -> reader.read(write(mapper, directory, root))).isInstanceOf(CourseRouteException.class);
        var promoted = document(mapper);
        ((ObjectNode) promoted.path("features").get(0).path("properties")).put("status", "VERIFIED");
        assertThatThrownBy(() -> reader.read(write(mapper, directory, promoted))).isInstanceOf(CourseRouteException.class);
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "ROUTE_SAMPLE_GEOJSON", matches = ".+")
    void validatesLocalAttachmentWithoutBundlingItInGit() {
        var result = reader.read(Path.of(System.getenv("ROUTE_SAMPLE_GEOJSON")));
        assertThat(result.routes()).hasSize(13);
    }
}
