package com.all4land.trailmap.domain.terrain.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TerrainTileJsonResponse(
        String tilejson,
        String name,
        String scheme,
        List<String> tiles,
        @JsonProperty("minzoom") int minZoom,
        @JsonProperty("maxzoom") int maxZoom,
        List<Double> bounds
) {
    public TerrainTileJsonResponse withTiles(List<String> tileUrls) {
        return new TerrainTileJsonResponse(
                tilejson,
                name,
                scheme,
                List.copyOf(tileUrls),
                minZoom,
                maxZoom,
                List.copyOf(bounds)
        );
    }
}
