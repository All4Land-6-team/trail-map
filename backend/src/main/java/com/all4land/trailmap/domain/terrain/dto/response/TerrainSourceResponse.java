package com.all4land.trailmap.domain.terrain.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TerrainSourceResponse(
        String type,
        List<String> tiles,
        @JsonProperty("minzoom") int minZoom,
        @JsonProperty("maxzoom") int maxZoom,
        List<Double> bounds,
        int tileSize,
        String encoding
) {
    public TerrainSourceResponse withTiles(List<String> tileUrls) {
        return new TerrainSourceResponse(
                type,
                List.copyOf(tileUrls),
                minZoom,
                maxZoom,
                List.copyOf(bounds),
                tileSize,
                encoding
        );
    }
}
