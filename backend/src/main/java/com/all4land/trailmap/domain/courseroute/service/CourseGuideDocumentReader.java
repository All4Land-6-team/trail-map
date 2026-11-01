package com.all4land.trailmap.domain.courseroute.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;

@Component
@RequiredArgsConstructor
public class CourseGuideDocumentReader {
    private final ObjectMapper mapper;
    public record Guide(String routeRecordId, String mountainKey, String routeHash, String officialCourseId,
                        String routeLabel, String difficultyGrade, double distanceMeters, int durationSeconds,
                        String sourceUrl, String checkedOn) {
        public String difficulty() {
            return switch (difficultyGrade) { case "하" -> "BEGINNER"; case "중" -> "INTERMEDIATE"; case "상" -> "EXPERT";
                default -> throw new IllegalArgumentException("Unknown official difficulty"); };
        }
    }
    public record Input(int schemaVersion, String datasetKey, List<Guide> courses) {}
    public record Document(Input input, String hash) {}

    public Document read(Path path) {
        try {
            if (Files.size(path) > 1_000_000) throw new IllegalArgumentException("Guide document is too large");
            byte[] bytes = Files.readAllBytes(path);
            var tree = mapper.readTree(bytes);
            if (!tree.path("schemaVersion").isInt() || !tree.path("courses").isArray())
                throw new IllegalArgumentException("Invalid guide field types");
            for (var row : tree.path("courses")) {
                if (!row.path("durationSeconds").isInt() || !row.path("distanceMeters").isNumber())
                    throw new IllegalArgumentException("Guide duration and distance must be numeric");
                for (String field : List.of("routeRecordId", "mountainKey", "routeHash", "officialCourseId", "routeLabel", "difficultyGrade", "sourceUrl", "checkedOn")) {
                    if (!row.path(field).isTextual()) throw new IllegalArgumentException("Guide text field required: " + field);
                }
            }
            var input = mapper.readValue(bytes, Input.class);
            if (input.schemaVersion() != 1 || !CourseRouteImportService.DATASET_KEY.equals(input.datasetKey())
                    || input.courses() == null || input.courses().size() != 13) throw new IllegalArgumentException("Expected 13 route guides");
            var ids = new HashSet<String>();
            var officialIds = new HashSet<String>();
            for (var guide : input.courses()) {
                if (guide == null || guide.routeRecordId() == null || !guide.routeRecordId().matches("BUKHAN_(0[1-9]|1[0-3])")
                        || !ids.add(guide.routeRecordId()) || !List.of("bukhansan", "dobongsan").contains(guide.mountainKey())
                        || guide.routeHash() == null || !guide.routeHash().matches("[0-9a-f]{64}")
                        || guide.officialCourseId() == null || !guide.officialCourseId().matches("121500V00[1-9]|121500V01[0-3]")
                        || !officialIds.add(guide.officialCourseId())
                        || !guide.officialCourseId().endsWith("0" + guide.routeRecordId().substring(7))
                        || guide.routeLabel() == null || guide.routeLabel().isBlank() || guide.routeLabel().length() > 2000
                        || !Double.isFinite(guide.distanceMeters()) || guide.distanceMeters() <= 0
                        || guide.durationSeconds() <= 0 || guide.sourceUrl() == null
                        || !guide.sourceUrl().equals("https://www.knps.or.kr/front/portal/visit/visitCourseSubMain.do?menuNo=8000275&parkId=121500&parkNavGb=guide&vcursId=" + guide.officialCourseId())
                        || LocalDate.parse(guide.checkedOn()).isAfter(LocalDate.now())) throw new IllegalArgumentException("Invalid course guide");
                guide.difficulty();
            }
            return new Document(input, HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
        } catch (Exception exception) {
            throw new IllegalArgumentException("공식 코스 안내 입력을 확인해 주세요.", exception);
        }
    }
}
