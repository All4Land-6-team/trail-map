package com.all4land.trailmap.domain.courseroute;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.file.Path;

public final class RouteTestDocuments {
    private RouteTestDocuments() {}

    public static ObjectNode document(ObjectMapper mapper) {
        var root = mapper.createObjectNode().put("type", "FeatureCollection");
        var features = root.putArray("features");
        for (int n = 1; n <= 13; n++) {
            var feature = features.addObject().put("type", "Feature");
            feature.putObject("properties").put("course_id", "BUKHAN_%02d".formatted(n))
                    .put("course_name", "검증 코스 " + n).put("route_order", n).put("via", "시작~정상")
                    .put("status", "candidate_smap_unverified").put("check_note", "공식 검증 전")
                    .put("official_km", 2.0);
            var coordinates = feature.putObject("geometry").put("type", "LineString").putArray("coordinates");
            coordinates.addArray().add(127.0).add(37.7);
            coordinates.addArray().add(127.0).add(37.7);
            coordinates.addArray().add(127.001).add(37.701);
            coordinates.addArray().add(127.0).add(37.7);
        }
        return root;
    }

    public static Path write(ObjectMapper mapper, Path directory, ObjectNode document) throws IOException {
        Path file = directory.resolve("routes.geojson");
        mapper.writeValue(file.toFile(), document);
        return file;
    }
}
