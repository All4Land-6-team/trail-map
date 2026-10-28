package com.all4land.trailmap.domain.courseanalysis.service;

import com.all4land.trailmap.domain.courseanalysis.dto.request.CourseAnalysisDocument;
import com.all4land.trailmap.domain.courseanalysis.dto.request.CourseAnalysisDocument.*;
import com.all4land.trailmap.domain.courseanalysis.entity.AnalysisQualityStatus;
import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 외부 계산 결과를 DB에 넣기 전에 형식뿐 아니라 프로필·요약의 일관성을 검증한다. */
@Component
public class CourseAnalysisDocumentReader {
    public static final int MAX_BYTES = 64 * 1024 * 1024;
    private static final int MAX_SAMPLES = 100_000;
    private static final Set<String> SAMPLE_STATUSES = Set.of(
            "VALID", "OUTSIDE_DEM", "INSUFFICIENT_NEIGHBORS", "NODATA", "NON_FINITE");
    private final ObjectMapper mapper;

    @SuppressWarnings("deprecation")
    public CourseAnalysisDocumentReader(ObjectMapper mapper) {
        this.mapper = mapper.copy().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
                .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS);
    }

    public record Validated(CourseAnalysisDocument document, String hash) {}
    public record Stored(long analysisId, long demSourceId, String documentHash, CourseAnalysisDocument document) {}

    public Validated read(Path path) {
        try {
            var document = mapper.readValue(bytes(path), CourseAnalysisDocument.class);
            validate(document);
            return new Validated(document, hash(mapper.writeValueAsBytes(document)));
        } catch (IOException | IllegalArgumentException exception) {
            throw invalid("JSON을 읽을 수 없습니다");
        }
    }

    public Stored readStored(Path path) {
        try {
            Stored stored = mapper.readValue(bytes(path), Stored.class);
            require(stored != null && stored.analysisId() > 0 && stored.demSourceId() > 0, "저장 식별자");
            validate(stored.document());
            require(hash(mapper.writeValueAsBytes(stored.document())).equals(stored.documentHash()), "저장 파일 지문");
            return stored;
        } catch (IOException | IllegalArgumentException exception) {
            throw invalid("저장 JSON을 읽을 수 없습니다");
        }
    }

    public byte[] encode(Stored stored) {
        try {
            byte[] bytes = mapper.writeValueAsBytes(stored);
            require(bytes.length <= MAX_BYTES, "저장 파일 크기");
            return bytes;
        } catch (IOException exception) {
            throw invalid("JSON 직렬화");
        }
    }

    public String geometryJson(Geometry geometry) {
        try {
            return mapper.writeValueAsString(geometry);
        } catch (IOException exception) {
            throw invalid("경로 직렬화");
        }
    }

    public boolean sameGeometry(Geometry expected, String snapshot) {
        try {
            Geometry actual = mapper.readValue(snapshot, Geometry.class);
            if (!expected.type().equals(actual.type()) || actual.coordinates() == null
                    || expected.coordinates().size() != actual.coordinates().size()) return false;
            for (int i = 0; i < expected.coordinates().size(); i++) {
                var point = actual.coordinates().get(i);
                if (point == null || point.size() != 2) return false;
                for (int j = 0; j < 2; j++) {
                    if (!finite(point.get(j)) || Math.abs(expected.coordinates().get(i).get(j) - point.get(j)) > 1e-9) {
                        return false;
                    }
                }
            }
            return true;
        } catch (IOException exception) {
            return false;
        }
    }

    /** 경로 대신 DEM 내용·보조 파일 지문·좌표계·밴드 정보를 출처 버전으로 사용한다. */
    public String demVersion(Dem dem, Settings settings) {
        ObjectNode metadata = mapper.valueToTree(dem);
        removeDemPaths(metadata);
        // 단위·수직 기준 확인은 DEM 해석의 새 버전이다. 이전 결과를 덮어쓰지 않고 보존한다.
        metadata.putObject("elevation_interpretation")
                .put("unit", settings.elevationUnit()).put("unit_source", settings.elevationUnitSource())
                .put("vertical_reference", settings.verticalReference());
        try {
            return hash(mapper.writeValueAsBytes(metadata));
        } catch (IOException exception) {
            throw invalid("DEM 버전");
        }
    }

    /** 같은 계산을 다른 시간·폴더에서 다시 실행한 경우 기존 결과를 그대로 재사용한다. */
    public boolean sameResult(CourseAnalysisDocument before, CourseAnalysisDocument after) {
        return resultIdentity(before).equals(resultIdentity(after));
    }

    private ObjectNode resultIdentity(CourseAnalysisDocument document) {
        ObjectNode node = mapper.valueToTree(document);
        node.remove("calculated_at");
        ObjectNode inputs = (ObjectNode) node.get("inputs");
        ((ObjectNode) inputs.get("course")).remove("path");
        removeDemPaths((ObjectNode) inputs.get("dem"));
        return node;
    }

    private void removeDemPaths(ObjectNode dem) {
        dem.remove("path");
        for (var file : dem.withArray("auxiliary_files")) ((ObjectNode) file).remove("path");
    }

    private byte[] bytes(Path path) throws IOException {
        // size() 검사 뒤 파일이 커져도 상한보다 많이 읽지 않는다.
        try (var input = Files.newInputStream(path)) {
            byte[] bytes = input.readNBytes(MAX_BYTES + 1);
            require(bytes.length <= MAX_BYTES, "파일 크기(최대 64 MiB)");
            return bytes;
        }
    }

    public void validate(CourseAnalysisDocument document) {
        require(document != null && Integer.valueOf(1).equals(document.schemaVersion()), "schema_version");
        require(text(document.algorithmVersion(), 100), "algorithm_version");
        require("SERVICE_CALCULATED".equals(document.sourceType()), "source_type");
        require(document.calculatedAt() != null, "calculated_at");
        Course course = document.course();
        require(course != null && positive(course.courseId()) && positive(course.mountainId())
                && course.courseVersion() != null && course.courseVersion() > 0
                && (course.sourceId() == null || positive(course.sourceId())), "course 식별자");
        member(course.sourceKind(), Set.of("development", "official", "user", "unknown"), "source_kind");
        require(course.courseName() == null || course.courseName().length() <= 200, "course_name");
        Geometry geometry = course.geometry();
        require(geometry != null && "LineString".equals(geometry.type()) && geometry.coordinates() != null
                && geometry.coordinates().size() >= 2 && geometry.coordinates().size() <= MAX_SAMPLES, "geometry");
        for (List<Double> point : geometry.coordinates()) {
            require(point != null && point.size() == 2, "경로 좌표 차원");
            coordinate(point.get(0), point.get(1));
        }
        require(geometry.coordinates().stream().distinct().count() > 1, "길이가 없는 경로");
        validateInputs(document.inputs());
        Settings settings = document.settings();
        validateSettings(settings, document.inputs().dem());
        List<Sample> samples = document.profile();
        require(samples != null && samples.size() >= 2 && samples.size() <= settings.maxSamples()
                && geometry.coordinates().size() <= settings.maxSamples(), "profile 개수");

        int rawValid = 0, metricValid = 0, segments = 0;
        double covered = 0, gain = 0, loss = 0;
        Double minimum = null, maximum = null;
        Map<String, Integer> counts = new HashMap<>();
        Double factor = switch (settings.elevationUnit()) {
            case "m" -> 1.0;
            case "ft" -> 0.3048;
            default -> null;
        };
        for (int i = 0; i < samples.size(); i++) {
            Sample sample = samples.get(i);
            require(sample != null && Integer.valueOf(i).equals(sample.sampleIndex()), "sample_index");
            coordinate(sample.longitude(), sample.latitude());
            require(finite(sample.distanceMeters()) && sample.distanceMeters() >= 0, "distance_meters");
            member(sample.sampleStatus(), SAMPLE_STATUSES, "sample_status");
            counts.merge(sample.sampleStatus(), 1, Integer::sum);
            boolean valid = "VALID".equals(sample.sampleStatus());
            require(valid ? finite(sample.elevationSourceValue()) : sample.elevationSourceValue() == null,
                    "원본 고도와 sample_status");
            Double height = valid && factor != null ? sample.elevationSourceValue() * factor : null;
            same(sample.elevationMeters(), height, "elevation_meters");
            if (valid) rawValid++;
            if (height != null) {
                metricValid++;
                minimum = minimum == null ? height : Math.min(minimum, height);
                maximum = maximum == null ? height : Math.max(maximum, height);
            }
            Double grade = null;
            if (i == 0) {
                same(sample.distanceMeters(), 0.0, "첫 누적 거리");
            } else {
                Sample before = samples.get(i - 1);
                double distance = sample.distanceMeters() - before.distanceMeters();
                require(distance > 0 && distance <= settings.sampleIntervalMeters() + 1e-6, "샘플 간격");
                if (valid && "VALID".equals(before.sampleStatus())) covered += distance;
                if (height != null && before.elevationMeters() != null) {
                    double delta = height - before.elevationMeters();
                    grade = 100 * delta / distance;
                    gain += Math.max(delta, 0);
                    loss += Math.max(-delta, 0);
                    segments++;
                }
            }
            same(sample.slopePercent(), grade, "slope_percent 또는 결측 구간 연결");
        }
        endpoint(samples.getFirst(), geometry.coordinates().getFirst());
        endpoint(samples.getLast(), geometry.coordinates().getLast());
        Summary summary = document.summary();
        require(summary != null, "summary");
        double total = samples.getLast().distanceMeters();
        require(total > 0, "전체 거리");
        same(summary.distanceMeters(), total, "요약 거리");
        require(Integer.valueOf(samples.size()).equals(summary.sampleCount())
                && Integer.valueOf(rawValid).equals(summary.validDemSampleCount())
                && Integer.valueOf(metricValid).equals(summary.validElevationMetersSampleCount())
                && Integer.valueOf(segments).equals(summary.analyzedSegmentCount()), "요약 개수");
        same(summary.minElevationMeters(), minimum, "최저 고도");
        same(summary.maxElevationMeters(), maximum, "최고 고도");
        same(summary.elevationGainMeters(), segments == 0 ? null : gain, "누적 상승");
        same(summary.elevationLossMeters(), segments == 0 ? null : loss, "누적 하강");
        same(summary.sampleCoveragePercent(), 100.0 * rawValid / samples.size(), "샘플 커버리지");
        same(summary.coveredDistanceMeters(), covered, "관측 거리");
        same(summary.distanceCoveragePercent(), 100.0 * covered / total, "거리 커버리지");
        Diagnostics diagnostics = document.diagnostics();
        require(diagnostics != null && diagnostics.removedConsecutiveDuplicateCount() != null
                && diagnostics.removedConsecutiveDuplicateCount() >= 0
                && diagnostics.removedConsecutiveDuplicateCount() <= geometry.coordinates().size() - 2
                && counts.equals(diagnostics.sampleStatusCounts()), "diagnostics");
        List<String> reasons = new ArrayList<>();
        if (rawValid < samples.size()) reasons.add("MISSING_DEM_SAMPLES");
        if (factor == null) reasons.add("UNVERIFIED_ELEVATION_UNIT");
        if (settings.verticalReference() == null) reasons.add("UNVERIFIED_VERTICAL_REFERENCE");
        if (segments == 0) reasons.add("NO_CONTIGUOUS_METRIC_HEIGHT_SEGMENTS");
        AnalysisQualityStatus status = rawValid == 0 ? AnalysisQualityStatus.NO_DATA
                : reasons.isEmpty() ? AnalysisQualityStatus.AVAILABLE : AnalysisQualityStatus.PARTIAL;
        require(status == document.qualityStatus() && document.qualityReasons() != null
                && document.qualityReasons().size() == reasons.size()
                && new HashSet<>(document.qualityReasons()).equals(new HashSet<>(reasons)), "품질 상태와 사유");
    }

    private void validateInputs(Inputs inputs) {
        require(inputs != null && inputs.course() != null && inputs.dem() != null, "inputs");
        inputFile(inputs.course());
        Dem dem = inputs.dem();
        inputFile(new InputFile(dem.path(), dem.sha256()));
        require(text(dem.crsWkt(), 16_000) && text(dem.linearUnit(), 100)
                && finite(dem.linearUnitToMeters()) && dem.linearUnitToMeters() > 0
                && finite(dem.bandScale()) && finite(dem.bandOffset())
                && (dem.bandUnit() == null || text(dem.bandUnit(), 100)), "DEM 메타데이터");
        require(dem.crsAuthority() == null || dem.crsAuthority().size() == 2
                && dem.crsAuthority().stream().allMatch(v -> text(v, 40)), "crs_authority");
        require(dem.auxiliaryFiles() != null && dem.auxiliaryFiles().size() <= 100, "DEM 보조 파일");
        dem.auxiliaryFiles().forEach(this::inputFile);
    }

    private void validateSettings(Settings settings, Dem dem) {
        require(settings != null && finite(settings.sampleIntervalMeters()) && settings.sampleIntervalMeters() > 0
                && settings.maxSamples() != null && settings.maxSamples() >= 2 && settings.maxSamples() <= MAX_SAMPLES,
                "샘플 설정");
        member(settings.samplingMethod(), Set.of("nearest", "bilinear"), "sampling_method");
        require("horizontal_chainage_preserve_vertices".equals(settings.resamplingMethod())
                && "projected_2d_dem_crs".equals(settings.distanceMethod())
                && "unsmoothed".equals(settings.elevationProcessing())
                && "signed_percent_from_previous_sample".equals(settings.slopeConvention()), "분석 방식");
        member(settings.elevationUnit(), Set.of("m", "ft", "unknown"), "elevation_unit");
        member(settings.elevationUnitSource(), Set.of("raster_metadata", "caller_declaration", "unverified"),
                "elevation_unit_source");
        require("unknown".equals(settings.elevationUnit()) == "unverified".equals(settings.elevationUnitSource()),
                "단위 확인 상태");
        if (!"unknown".equals(settings.elevationUnit())
                && ("raster_metadata".equals(settings.elevationUnitSource()) || dem.bandUnit() != null)) {
            String unit = dem.bandUnit() == null ? "" : dem.bandUnit().strip().toLowerCase(java.util.Locale.ROOT);
            String normalized = switch (unit) {
                case "m", "meter", "metre", "meters", "metres" -> "m";
                case "ft", "foot", "feet", "international foot" -> "ft";
                default -> "unknown";
            };
            require(normalized.equals(settings.elevationUnit()), "밴드 단위와 선언 단위");
        }
        String reference = settings.verticalReference();
        require(reference == null || text(reference, 300) && reference.equals(reference.strip())
                && !Set.of("unknown", "unverified").contains(reference.toLowerCase(java.util.Locale.ROOT)), "수직 기준");
    }

    private void inputFile(InputFile file) {
        require(file != null && text(file.path(), 8_000) && file.sha256() != null
                && file.sha256().matches("[0-9a-f]{64}"), "입력 파일 지문");
    }

    private static void endpoint(Sample sample, List<Double> point) {
        require(Math.abs(sample.longitude() - point.get(0)) < 1e-7
                && Math.abs(sample.latitude() - point.get(1)) < 1e-7, "경로 시작·끝 좌표");
    }

    private static void coordinate(Double longitude, Double latitude) {
        require(finite(longitude) && finite(latitude) && longitude >= -180 && longitude <= 180
                && latitude >= -90 && latitude <= 90, "경도·위도");
    }

    public static boolean close(Double first, Double second) {
        return first == null || second == null ? first == second
                : finite(first) && finite(second)
                && Math.abs(first - second) <= 1e-7 + 1e-9 * Math.max(Math.abs(first), Math.abs(second));
    }

    private static void same(Double value, Double expected, String field) {
        require(close(value, expected), field);
    }

    private static boolean finite(Double value) { return value != null && Double.isFinite(value); }
    private static boolean positive(Long value) { return value != null && value > 0; }
    private static boolean text(String value, int maximum) { return value != null && !value.isBlank() && value.length() <= maximum; }
    private static void member(String value, Set<String> allowed, String field) { require(value != null && allowed.contains(value), field); }
    private static void require(boolean condition, String field) { if (!condition) throw invalid(field); }

    private static CourseAnalysisException invalid(String field) {
        CourseAnalysisException exception = new CourseAnalysisException(CourseAnalysisErrorCode.INVALID_DOCUMENT);
        exception.initCause(new IllegalArgumentException(field));
        return exception;
    }

    private static String hash(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
