package com.all4land.trailmap.domain.courseroute;

import com.all4land.trailmap.domain.courseroute.service.CourseGuideDocumentReader;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import static org.assertj.core.api.Assertions.*;

class CourseGuideDocumentReaderTest {
    @TempDir Path directory;
    private final ObjectMapper mapper = new ObjectMapper();
    private final CourseGuideDocumentReader reader = new CourseGuideDocumentReader(mapper);

    static ObjectNode guideDocument(ObjectMapper mapper) {
        var root = mapper.createObjectNode().put("schemaVersion", 1).put("datasetKey", "bukhansan-13-candidate");
        var courses = root.putArray("courses");
        for (int n = 1; n <= 13; n++) {
            String official = "121500V%03d".formatted(n);
            courses.addObject().put("routeRecordId", "BUKHAN_%02d".formatted(n))
                    .put("mountainKey", n >= 3 && n <= 7 ? "dobongsan" : "bukhansan")
                    .put("routeHash", "a".repeat(64)).put("officialCourseId", official)
                    .put("routeLabel", "시작~정상").put("difficultyGrade", n == 1 ? "중" : "하")
                    .put("distanceMeters", 2000).put("durationSeconds", 5400)
                    .put("checkedOn", "2026-11-01")
                    .put("sourceUrl", "https://www.knps.or.kr/front/portal/visit/visitCourseSubMain.do?menuNo=8000275&parkId=121500&parkNavGb=guide&vcursId=" + official);
        }
        return root;
    }

    @Test void validatesThirteenGuidesAndMapsOfficialGrades() throws Exception {
        var file = directory.resolve("guide.json");
        mapper.writeValue(file.toFile(), guideDocument(mapper));
        var doc = reader.read(file);
        assertThat(doc.hash()).matches("[0-9a-f]{64}");
        assertThat(doc.input().courses()).hasSize(13);
        assertThat(doc.input().courses().getFirst().difficulty()).isEqualTo("INTERMEDIATE");
        assertThat(doc.input().courses().get(1).difficulty()).isEqualTo("BEGINNER");
        var upper = guideDocument(mapper);
        ((ObjectNode) upper.path("courses").get(0)).put("difficultyGrade", "상");
        mapper.writeValue(file.toFile(), upper);
        assertThat(reader.read(file).input().courses().getFirst().difficulty()).isEqualTo("EXPERT");
    }

    @Test void rejectsDuplicatesWrongIdentityUrlGradeAndInvalidNumbers() throws Exception {
        for (String field : new String[]{"routeRecordId", "officialCourseId", "routeHash", "difficultyGrade", "sourceUrl", "checkedOn", "durationSeconds", "distanceMeters"}) {
            var doc = guideDocument(mapper);
            var row = (ObjectNode) doc.path("courses").get(0);
            switch (field) {
                case "routeRecordId" -> row.put(field, "BUKHAN_02");
                case "officialCourseId" -> row.put(field, "121500V002");
                case "durationSeconds", "distanceMeters" -> row.put(field, -1);
                default -> row.put(field, "invalid");
            }
            var file = directory.resolve("bad.json");
            mapper.writeValue(file.toFile(), doc);
            assertThatThrownBy(() -> reader.read(file)).as(field).isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test void rejectsImplicitDurationCoercion() throws Exception {
        var doc = guideDocument(mapper);
        var file = directory.resolve("bad-number.json");
        var row = (ObjectNode) doc.path("courses").get(0);
        row.put("durationSeconds", 5400.9);
        mapper.writeValue(file.toFile(), doc);
        assertThatThrownBy(() -> reader.read(file)).isInstanceOf(IllegalArgumentException.class);
        row.put("durationSeconds", "5400");
        mapper.writeValue(file.toFile(), doc);
        assertThatThrownBy(() -> reader.read(file)).isInstanceOf(IllegalArgumentException.class);
    }
}
