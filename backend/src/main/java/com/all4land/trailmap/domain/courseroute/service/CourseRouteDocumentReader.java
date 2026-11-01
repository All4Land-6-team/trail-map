package com.all4land.trailmap.domain.courseroute.service;

import com.all4land.trailmap.domain.courseroute.exception.CourseRouteException;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;

import static com.all4land.trailmap.domain.courseroute.error.CourseRouteErrorCode.INVALID_DOCUMENT;

@Component
public class CourseRouteDocumentReader {
    private static final long MAX_BYTES = 64L * 1024 * 1024;
    private final ObjectMapper mapper;

    public CourseRouteDocumentReader(ObjectMapper mapper) { this.mapper = mapper; }

    public record Document(String fileHash, List<Route> routes) {}
    public record Route(String recordId, String name, int order, String mountainKey, String via,
                        Double officialMeters, String status, String note, String geometry, String hash) {}

    public Document read(Path file) {
        try {
            require(Files.isRegularFile(file) && Files.size(file) <= MAX_BYTES);
            byte[] bytes;
            try (var stream = Files.newInputStream(file)) {
                bytes = stream.readNBytes((int) MAX_BYTES + 1);
            }
            require(bytes.length <= MAX_BYTES);
            JsonNode root;
            try (var parser = mapper.getFactory().createParser(bytes)) {
                parser.enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
                root = mapper.readTree(parser);
                require(parser.nextToken() == null);
            }
            require(root != null && "FeatureCollection".equals(root.path("type").asText()));
            if (root.has("crs")) require("urn:ogc:def:crs:OGC:1.3:CRS84".equals(
                    root.path("crs").path("properties").path("name").asText()));
            JsonNode features = root.path("features");
            require(features.isArray() && features.size() == 13);
            var ids = new HashSet<String>();
            var routes = new ArrayList<Route>();
            for (JsonNode feature : features) {
                require("Feature".equals(feature.path("type").asText()));
                JsonNode properties = feature.path("properties");
                String id = text(properties, "course_id", 200);
                require(id.matches("BUKHAN_(0[1-9]|1[0-3])") && ids.add(id));
                int order = Integer.parseInt(id.substring(7));
                require(properties.path("route_order").isIntegralNumber()
                        && properties.path("route_order").canConvertToInt()
                        && properties.path("route_order").intValue() == order);
                String name = text(properties, "course_name", 200);
                String via = text(properties, "via", 2000);
                String status = text(properties, "status", 100);
                require("candidate_smap_unverified".equals(status));
                String note = text(properties, "check_note", 10000);
                Double official = null;
                JsonNode officialKm = properties.path("official_km");
                if (!officialKm.isMissingNode() && !officialKm.isNull()) {
                    require(officialKm.isNumber() && Double.isFinite(officialKm.doubleValue())
                            && officialKm.doubleValue() > 0 && Double.isFinite(officialKm.doubleValue() * 1000));
                    official = officialKm.doubleValue() * 1000;
                }
                JsonNode geometry = feature.path("geometry");
                require("LineString".equals(geometry.path("type").asText()));
                JsonNode points = geometry.path("coordinates");
                require(points.isArray() && points.size() >= 2 && points.size() <= 100000);
                var clean = mapper.createArrayNode();
                double previousX = Double.NaN, previousY = Double.NaN;
                for (JsonNode point : points) {
                    require(point.isArray() && point.size() == 2 && point.get(0).isNumber() && point.get(1).isNumber());
                    double x = point.get(0).doubleValue(), y = point.get(1).doubleValue();
                    require(Double.isFinite(x) && Double.isFinite(y) && x >= -180 && x <= 180 && y >= -90 && y <= 90);
                    if (x != previousX || y != previousY) clean.addArray().add(x).add(y);
                    previousX = x; previousY = y;
                }
                require(clean.size() >= 2);
                String normalized = mapper.createObjectNode().put("type", "LineString").set("coordinates", clean).toString();
                routes.add(new Route(id, name, order, order >= 3 && order <= 7 ? "dobongsan" : "bukhansan",
                        via, official, status, note, normalized, hash(mapper.writeValueAsBytes(feature))));
            }
            routes.sort(java.util.Comparator.comparingInt(Route::order));
            return new Document(hash(bytes), List.copyOf(routes));
        } catch (IOException | IllegalArgumentException exception) {
            throw new CourseRouteException(INVALID_DOCUMENT);
        }
    }

    private static String text(JsonNode node, String key, int max) {
        JsonNode value = node.path(key);
        require(value.isTextual() && !value.textValue().isBlank() && value.textValue().length() <= max);
        return value.textValue();
    }

    private static void require(boolean condition) {
        if (!condition) throw new CourseRouteException(INVALID_DOCUMENT);
    }

    private static String hash(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
}
