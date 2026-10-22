package com.all4land.trailmap.domain.terrain.controller;

import com.all4land.trailmap.domain.terrain.dto.response.TerrainSourceResponse;
import com.all4land.trailmap.domain.terrain.dto.response.TerrainTileJsonResponse;
import com.all4land.trailmap.domain.terrain.error.TerrainErrorCode;
import com.all4land.trailmap.domain.terrain.exception.TerrainException;
import com.all4land.trailmap.domain.terrain.service.TerrainService;
import com.all4land.trailmap.global.config.TerrainProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TerrainController.class)
class TerrainControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    TerrainService terrainService;

    @MockitoBean
    TerrainProperties terrainProperties;

    @Test
    void TileJSON을_표준_형식으로_반환한다() throws Exception {
        given(terrainService.getTileJson()).willReturn(new TerrainTileJsonResponse(
                "3.0.0",
                "bukhansan_dem",
                "xyz",
                List.of("http://localhost:8080/api/v1/terrain/{z}/{x}/{y}.png"),
                10,
                16,
                List.of(126.9, 37.5, 127.1, 37.8)
        ));

        mockMvc.perform(get("/v1/terrain/tilejson"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.tilejson").value("3.0.0"))
                .andExpect(jsonPath("$.tiles[0]").value(
                        "http://localhost:8080/api/v1/terrain/{z}/{x}/{y}.png"
                ))
                .andExpect(jsonPath("$.minzoom").value(10))
                .andExpect(jsonPath("$.success").doesNotExist());
    }

    @Test
    void MapLibre_소스를_표준_형식으로_반환한다() throws Exception {
        given(terrainService.getSource()).willReturn(new TerrainSourceResponse(
                "raster-dem",
                List.of("http://localhost:8080/api/v1/terrain/{z}/{x}/{y}.png"),
                10,
                16,
                List.of(126.9, 37.5, 127.1, 37.8),
                256,
                "mapbox"
        ));

        mockMvc.perform(get("/v1/terrain/source"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("raster-dem"))
                .andExpect(jsonPath("$.tileSize").value(256))
                .andExpect(jsonPath("$.encoding").value("mapbox"));
    }

    @Test
    void Terrain_RGB_타일을_PNG로_반환한다() throws Exception {
        byte[] png = {(byte) 0x89, 0x50, 0x4E, 0x47};
        given(terrainService.getTile(10, 872, 395)).willReturn(png);
        given(terrainProperties.cacheMaxAge()).willReturn(Duration.ZERO);

        mockMvc.perform(get("/v1/terrain/10/872/395.png"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(header().longValue("Content-Length", png.length))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().bytes(png));
    }

    @Test
    void 양수_캐시_시간은_공개_캐시_헤더로_반환한다() throws Exception {
        byte[] png = {(byte) 0x89, 0x50, 0x4E, 0x47};
        given(terrainService.getTile(10, 872, 395)).willReturn(png);
        given(terrainProperties.cacheMaxAge()).willReturn(Duration.ofHours(1));

        mockMvc.perform(get("/v1/terrain/10/872/395.png"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "max-age=3600, public"));
    }

    @Test
    void 없는_타일은_공통_오류_응답을_반환한다() throws Exception {
        given(terrainService.getTile(10, 872, 395))
                .willThrow(new TerrainException(TerrainErrorCode.TILE_NOT_FOUND));

        mockMvc.perform(get("/v1/terrain/10/872/395.png"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("TERRAIN_404_1"))
                .andExpect(jsonPath("$.httpStatus").value(404));
    }
}
