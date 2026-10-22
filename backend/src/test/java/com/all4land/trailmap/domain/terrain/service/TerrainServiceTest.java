package com.all4land.trailmap.domain.terrain.service;

import com.all4land.trailmap.domain.terrain.dto.response.TerrainSourceResponse;
import com.all4land.trailmap.domain.terrain.dto.response.TerrainTileJsonResponse;
import com.all4land.trailmap.domain.terrain.error.TerrainErrorCode;
import com.all4land.trailmap.domain.terrain.exception.TerrainException;
import com.all4land.trailmap.global.config.TerrainProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TerrainServiceTest {

    @TempDir
    Path terrainRoot;

    private TerrainService terrainService;

    @BeforeEach
    void setUp() throws Exception {
        Files.writeString(terrainRoot.resolve("tilejson.json"), """
                {
                  "tilejson": "3.0.0",
                  "name": "bukhansan_dem",
                  "scheme": "xyz",
                  "tiles": ["./tiles/{z}/{x}/{y}.png"],
                  "minzoom": 10,
                  "maxzoom": 16,
                  "bounds": [126.9, 37.5, 127.1, 37.8]
                }
                """);
        Files.writeString(terrainRoot.resolve("maplibre-source.json"), """
                {
                  "type": "raster-dem",
                  "tiles": ["./tiles/{z}/{x}/{y}.png"],
                  "minzoom": 10,
                  "maxzoom": 16,
                  "bounds": [126.9, 37.5, 127.1, 37.8],
                  "tileSize": 256,
                  "encoding": "mapbox"
                }
                """);

        TerrainProperties properties = new TerrainProperties(
                terrainRoot,
                Duration.ZERO,
                "http://localhost:8080/api/v1/terrain/{z}/{x}/{y}.png"
        );
        terrainService = new TerrainService(properties, new ObjectMapper());
    }

    @Test
    void TileJSON의_타일_주소를_API_주소로_변환한다() {
        TerrainTileJsonResponse response = terrainService.getTileJson();

        assertThat(response.tiles()).containsExactly(
                "http://localhost:8080/api/v1/terrain/{z}/{x}/{y}.png"
        );
        assertThat(response.minZoom()).isEqualTo(10);
        assertThat(response.maxZoom()).isEqualTo(16);
    }

    @Test
    void MapLibre_소스의_타일_주소를_API_주소로_변환한다() {
        TerrainSourceResponse response = terrainService.getSource();

        assertThat(response.tiles()).containsExactly(
                "http://localhost:8080/api/v1/terrain/{z}/{x}/{y}.png"
        );
        assertThat(response.tileSize()).isEqualTo(256);
        assertThat(response.encoding()).isEqualTo("mapbox");
    }

    @Test
    void 존재하는_Terrain_RGB_타일을_조회한다() throws Exception {
        Path tile = terrainRoot.resolve("tiles/10/872/395.png");
        Files.createDirectories(tile.getParent());
        Files.write(tile, new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47});

        byte[] tileBytes = terrainService.getTile(10, 872, 395);

        assertThat(tileBytes).containsExactly(
                (byte) 0x89, 0x50, 0x4E, 0x47
        );
    }

    @Test
    void 생성된_줌_범위를_벗어나면_요청을_거부한다() {
        assertThatThrownBy(() -> terrainService.getTile(9, 0, 0))
                .isInstanceOf(TerrainException.class)
                .extracting(exception -> ((TerrainException) exception).getResponseCode())
                .isEqualTo(TerrainErrorCode.INVALID_TILE_COORDINATE);
    }

    @Test
    void XYZ_범위를_벗어난_좌표를_거부한다() {
        assertThatThrownBy(() -> terrainService.getTile(10, 1024, 0))
                .isInstanceOf(TerrainException.class)
                .extracting(exception -> ((TerrainException) exception).getResponseCode())
                .isEqualTo(TerrainErrorCode.INVALID_TILE_COORDINATE);
    }

    @Test
    void 존재하지_않는_타일은_찾을_수_없음으로_처리한다() {
        assertThatThrownBy(() -> terrainService.getTile(10, 872, 395))
                .isInstanceOf(TerrainException.class)
                .extracting(exception -> ((TerrainException) exception).getResponseCode())
                .isEqualTo(TerrainErrorCode.TILE_NOT_FOUND);
    }

    @Test
    void TileJSON을_읽을_수_없으면_데이터_오류로_처리한다() throws Exception {
        Files.delete(terrainRoot.resolve("tilejson.json"));

        assertThatThrownBy(terrainService::getTileJson)
                .isInstanceOf(TerrainException.class)
                .extracting(exception -> ((TerrainException) exception).getResponseCode())
                .isEqualTo(TerrainErrorCode.TERRAIN_DATA_UNAVAILABLE);
    }

    @Test
    void TileJSON과_MapLibre_소스의_범위가_다르면_데이터_오류로_처리한다() throws Exception {
        Files.writeString(terrainRoot.resolve("maplibre-source.json"), """
                {
                  "type": "raster-dem",
                  "tiles": ["./tiles/{z}/{x}/{y}.png"],
                  "minzoom": 11,
                  "maxzoom": 16,
                  "bounds": [126.9, 37.5, 127.1, 37.8],
                  "tileSize": 256,
                  "encoding": "mapbox"
                }
                """);

        assertThatThrownBy(terrainService::getSource)
                .isInstanceOf(TerrainException.class)
                .extracting(exception -> ((TerrainException) exception).getResponseCode())
                .isEqualTo(TerrainErrorCode.TERRAIN_DATA_UNAVAILABLE);
    }

    @Test
    void 타일_URL에_XYZ_치환자가_없으면_데이터_오류로_처리한다() {
        TerrainProperties invalidProperties = new TerrainProperties(
                terrainRoot,
                Duration.ZERO,
                "http://localhost:8080/api/v1/terrain/tiles.png"
        );
        TerrainService invalidService = new TerrainService(invalidProperties, new ObjectMapper());

        assertThatThrownBy(invalidService::getTileJson)
                .isInstanceOf(TerrainException.class)
                .extracting(exception -> ((TerrainException) exception).getResponseCode())
                .isEqualTo(TerrainErrorCode.TERRAIN_DATA_UNAVAILABLE);
    }

    @Test
    void 메타데이터는_최초_조회_후_캐시한다() throws Exception {
        TerrainTileJsonResponse firstResponse = terrainService.getTileJson();
        Files.delete(terrainRoot.resolve("tilejson.json"));
        Files.delete(terrainRoot.resolve("maplibre-source.json"));

        assertThat(terrainService.getTileJson()).isSameAs(firstResponse);
        assertThat(terrainService.getSource().tiles()).isEqualTo(firstResponse.tiles());
    }
}
