package com.all4land.trailmap.domain.community.weather;

import com.all4land.trailmap.global.config.weather.KmaProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
class KmaWeatherClient {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter KMA_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
    private static final Duration TIMEOUT = Duration.ofSeconds(3);

    private final KmaProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();

    Optional<KmaGridObservation> getGridObservation(OffsetDateTime capturedAt, double longitude, double latitude) {
        LocalDateTime captureTime = capturedAt.atZoneSameInstant(KST).toLocalDateTime().withSecond(0).withNano(0);
        LocalDateTime requested = captureTime.withMinute(captureTime.getMinute() - captureTime.getMinute() % 5);
        LocalDateTime latest = roundedCurrentTime(5);
        LocalDateTime start = requested.minusMinutes(30);
        LocalDateTime end = earlier(requested.plusMinutes(30), latest);
        JsonNode root = get("/api/typ01/url/sfc_nc_var.php", Map.of(
                "tm1", KMA_TIME.format(start),
                "tm2", KMA_TIME.format(end),
                "lon", String.valueOf(longitude),
                "lat", String.valueOf(latitude),
                "obs", "ta,rn_ox,rn_60m,vs,sd_3hr",
                "itv", "5",
                "disp", "1",
                "help", "0"
        ));
        return matchingObjects(root, "ta", "rn_ox", "rn_60m", "vs", "sd_3hr").stream()
                .map(node -> new KmaGridObservation(
                        observationTime(node, requested),
                        temperature(node),
                        nonNegative(node, "rn_ox"),
                        nonNegative(node, "rn_60m"),
                        nonNegative(node, "vs"),
                        nonNegative(node, "sd_3hr")
                ))
                .filter(KmaWeatherClient::hasGridData)
                .min(Comparator.comparingLong(value -> distanceMinutes(value.observedAt(), capturedAt)));
    }

    Optional<KmaAsosObservation> getAsosObservation(OffsetDateTime capturedAt, int stationId) {
        LocalDateTime requested = capturedAt.atZoneSameInstant(KST).toLocalDateTime().withMinute(0).withSecond(0).withNano(0);
        LocalDateTime end = earlier(requested.plusHours(1), roundedCurrentTime(60));
        JsonNode root = get("/api/typ01/url/kma_sfctm3.php", Map.of(
                "tm1", KMA_TIME.format(requested.minusHours(1)),
                "tm2", KMA_TIME.format(end),
                "stn", String.valueOf(stationId),
                "disp", "1",
                "help", "0"
        ));
        return matchingObjects(root, "STN", "CA_TOT", "WC", "WW").stream()
                .filter(node -> number(node, "STN").map(Number::intValue).orElse(stationId) == stationId)
                .map(node -> new KmaAsosObservation(
                        observationTime(node, requested),
                        number(node, "CA_TOT").filter(value -> value >= 0 && value <= 10).orElse(null),
                        number(node, "WC").map(Number::intValue).filter(value -> value >= 0).orElse(null),
                        text(node, "WW").filter(value -> !value.equals("-9")).orElse(null)
                ))
                .filter(KmaWeatherClient::hasWeatherData)
                .min(Comparator.comparingLong(value -> distanceMinutes(value.observedAt(), capturedAt)));
    }

    private JsonNode get(String path, Map<String, String> parameters) {
        if (!properties.configured()) {
            throw new IllegalStateException("기상청 API 인증키가 설정되지 않았습니다.");
        }
        var query = new LinkedHashMap<>(parameters);
        query.put("authKey", properties.authKey());
        String encoded = query.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .reduce((left, right) -> left + "&" + right)
                .orElse("");
        URI uri = URI.create(properties.baseUrl().replaceAll("/+$", "") + path + "?" + encoded);
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(TIMEOUT).GET().build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("기상청 API가 " + response.statusCode() + " 상태를 반환했습니다.");
            }
            return objectMapper.readTree(response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("기상청 API 요청이 중단되었습니다.", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("기상청 API 응답을 읽지 못했습니다: " + exception.getMessage(), exception);
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static List<JsonNode> matchingObjects(JsonNode root, String... fieldNames) {
        var found = new ArrayList<JsonNode>();
        collectMatchingObjects(root, found, fieldNames);
        return found;
    }

    private static void collectMatchingObjects(JsonNode node, List<JsonNode> found, String... fieldNames) {
        if (node == null) return;
        if (node.isObject()) {
            for (String fieldName : fieldNames) {
                if (field(node, fieldName).isPresent()) {
                    found.add(node);
                    return;
                }
            }
            node.elements().forEachRemaining(child -> collectMatchingObjects(child, found, fieldNames));
        } else if (node.isArray()) {
            node.elements().forEachRemaining(child -> collectMatchingObjects(child, found, fieldNames));
        }
    }

    private static Optional<JsonNode> field(JsonNode node, String name) {
        var fields = node.fields();
        while (fields.hasNext()) {
            var entry = fields.next();
            if (entry.getKey().equalsIgnoreCase(name)) return Optional.ofNullable(entry.getValue());
        }
        return Optional.empty();
    }

    private static Optional<String> text(JsonNode node, String name) {
        return field(node, name).filter(value -> !value.isNull()).map(JsonNode::asText)
                .map(String::trim).filter(value -> !value.isEmpty());
    }

    private static Optional<Double> number(JsonNode node, String name) {
        return text(node, name).flatMap(value -> {
            try {
                return Optional.of(Double.parseDouble(value));
            } catch (NumberFormatException ignored) {
                return Optional.empty();
            }
        });
    }

    private static Double nonNegative(JsonNode node, String name) {
        return number(node, name).filter(value -> value >= 0).orElse(null);
    }

    static Double temperature(JsonNode node) {
        return number(node, "ta").filter(value -> value >= -100 && value <= 100).orElse(null);
    }

    private static OffsetDateTime observationTime(JsonNode node, LocalDateTime fallback) {
        String raw = text(node, "TM").or(() -> text(node, "tm")).orElse(null);
        if (raw == null) return fallback.atZone(KST).toOffsetDateTime();
        for (DateTimeFormatter formatter : List.of(
                KMA_TIME,
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
        )) {
            try {
                return LocalDateTime.parse(raw, formatter).atZone(KST).toOffsetDateTime();
            } catch (DateTimeParseException ignored) {
                // 다음 형식을 확인한다.
            }
        }
        return fallback.atZone(KST).toOffsetDateTime();
    }

    private static long distanceMinutes(OffsetDateTime left, OffsetDateTime right) {
        return Math.abs(ChronoUnit.MINUTES.between(left.toInstant(), right.toInstant()));
    }

    private static boolean hasWeatherData(KmaAsosObservation observation) {
        return observation.totalCloudAmount() != null
                || observation.currentWeatherCode() != null
                || observation.domesticWeather() != null;
    }

    private static boolean hasGridData(KmaGridObservation observation) {
        return observation.temperatureC() != null
                || observation.rainOccurrence() != null
                || observation.hourlyRainMm() != null
                || observation.visibilityKilometers() != null
                || observation.threeHourSnowCm() != null;
    }

    private static LocalDateTime roundedCurrentTime(int minutes) {
        LocalDateTime now = LocalDateTime.now(KST).withSecond(0).withNano(0);
        return now.withMinute(now.getMinute() - now.getMinute() % minutes);
    }

    private static LocalDateTime earlier(LocalDateTime left, LocalDateTime right) {
        return left.isBefore(right) ? left : right;
    }

}
