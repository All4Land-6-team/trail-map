package com.all4land.trailmap.domain.terrain.service;

import com.all4land.trailmap.domain.terrain.dto.response.TerrainSourceResponse;
import com.all4land.trailmap.domain.terrain.dto.response.TerrainTileJsonResponse;
import com.all4land.trailmap.domain.terrain.error.TerrainErrorCode;
import com.all4land.trailmap.domain.terrain.exception.TerrainException;
import com.all4land.trailmap.global.config.TerrainProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TerrainService {

    private static final String TILE_JSON_FILE = "tilejson.json";
    private static final String MAPLIBRE_SOURCE_FILE = "maplibre-source.json";
    private final TerrainProperties properties;
    private final ObjectMapper objectMapper;

    private volatile TerrainMetadata metadataCache;

    public TerrainTileJsonResponse getTileJson() {
        return getMetadata().tileJson();
    }

    public TerrainSourceResponse getSource() {
        return getMetadata().source();
    }

    private TerrainMetadata getMetadata() {
        TerrainMetadata cached = metadataCache;
        if (cached != null) {
            return cached;
        }

        synchronized (this) {
            if (metadataCache == null) {
                TerrainTileJsonResponse tileJson = readJson(
                        TILE_JSON_FILE,
                        TerrainTileJsonResponse.class
                );
                TerrainSourceResponse source = readJson(
                        MAPLIBRE_SOURCE_FILE,
                        TerrainSourceResponse.class
                );
                validateMetadata(tileJson, source);

                List<String> tileUrls = List.of(properties.tilesUrl());
                metadataCache = new TerrainMetadata(
                        tileJson.withTiles(tileUrls),
                        source.withTiles(tileUrls)
                );
            }
            return metadataCache;
        }
    }

    public byte[] getTile(int zoom, int x, int y) {
        TerrainTileJsonResponse tileJson = getTileJson();
        validateTileCoordinate(zoom, x, y, tileJson.minZoom(), tileJson.maxZoom());

        Path tilesRoot = properties.rootPath()
                .resolve("tiles")
                .toAbsolutePath()
                .normalize();
        Path tilePath = tilesRoot
                .resolve(String.valueOf(zoom))
                .resolve(String.valueOf(x))
                .resolve(y + ".png")
                .normalize();

        if (!tilePath.startsWith(tilesRoot)) {
            throw new TerrainException(TerrainErrorCode.INVALID_TILE_COORDINATE);
        }
        try {
            if (!Files.isRegularFile(tilePath)) {
                throw new TerrainException(TerrainErrorCode.TILE_NOT_FOUND);
            }
            return Files.readAllBytes(tilePath);
        } catch (TerrainException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw new TerrainException(TerrainErrorCode.TERRAIN_DATA_UNAVAILABLE);
        }
    }

    private <T> T readJson(String fileName, Class<T> responseType) {
        try {
            Path filePath = properties.rootPath().resolve(fileName).normalize();
            return objectMapper.readValue(filePath.toFile(), responseType);
        } catch (IOException | RuntimeException exception) {
            throw new TerrainException(TerrainErrorCode.TERRAIN_DATA_UNAVAILABLE);
        }
    }

    private void validateMetadata(
            TerrainTileJsonResponse tileJson,
            TerrainSourceResponse source
    ) {
        validateTileJson(tileJson);
        validateSource(source);

        if (properties.tilesUrl() == null
                || !properties.tilesUrl().contains("{z}")
                || !properties.tilesUrl().contains("{x}")
                || !properties.tilesUrl().contains("{y}")
                || tileJson.minZoom() != source.minZoom()
                || tileJson.maxZoom() != source.maxZoom()
                || !tileJson.bounds().equals(source.bounds())) {
            throw new TerrainException(TerrainErrorCode.TERRAIN_DATA_UNAVAILABLE);
        }
    }

    private void validateTileJson(TerrainTileJsonResponse response) {
        if (!"3.0.0".equals(response.tilejson())
                || !"xyz".equals(response.scheme())
                || !isValidZoomRange(response.minZoom(), response.maxZoom())
                || response.bounds() == null
                || response.bounds().size() != 4) {
            throw new TerrainException(TerrainErrorCode.TERRAIN_DATA_UNAVAILABLE);
        }
    }

    private void validateSource(TerrainSourceResponse response) {
        if (!"raster-dem".equals(response.type())
                || !"mapbox".equals(response.encoding())
                || response.tileSize() != 256
                || !isValidZoomRange(response.minZoom(), response.maxZoom())
                || response.bounds() == null
                || response.bounds().size() != 4) {
            throw new TerrainException(TerrainErrorCode.TERRAIN_DATA_UNAVAILABLE);
        }
    }

    private boolean isValidZoomRange(int minZoom, int maxZoom) {
        return minZoom >= 0 && maxZoom <= 22 && minZoom <= maxZoom;
    }

    private void validateTileCoordinate(int zoom, int x, int y, int minZoom, int maxZoom) {
        if (zoom < minZoom || zoom > maxZoom) {
            throw new TerrainException(TerrainErrorCode.INVALID_TILE_COORDINATE);
        }

        int tileCount = 1 << zoom;
        if (x < 0 || y < 0 || x >= tileCount || y >= tileCount) {
            throw new TerrainException(TerrainErrorCode.INVALID_TILE_COORDINATE);
        }
    }

    private record TerrainMetadata(
            TerrainTileJsonResponse tileJson,
            TerrainSourceResponse source
    ) {
    }
}
