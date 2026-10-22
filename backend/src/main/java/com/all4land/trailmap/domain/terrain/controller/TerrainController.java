package com.all4land.trailmap.domain.terrain.controller;

import com.all4land.trailmap.domain.terrain.dto.response.TerrainSourceResponse;
import com.all4land.trailmap.domain.terrain.dto.response.TerrainTileJsonResponse;
import com.all4land.trailmap.domain.terrain.service.TerrainService;
import com.all4land.trailmap.global.config.TerrainProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/v1/terrain")
@RequiredArgsConstructor
public class TerrainController {

    private final TerrainService terrainService;
    private final TerrainProperties properties;

    @GetMapping("/tilejson")
    public TerrainTileJsonResponse getTileJson() {
        return terrainService.getTileJson();
    }

    @GetMapping("/source")
    public TerrainSourceResponse getSource() {
        return terrainService.getSource();
    }

    @GetMapping(value = "/{zoom}/{x}/{y}.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> getTile(
            @PathVariable int zoom,
            @PathVariable int x,
            @PathVariable int y
    ) {
        byte[] tile = terrainService.getTile(zoom, x, y);

        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .contentLength(tile.length)
                .cacheControl(cacheControl())
                .body(tile);
    }

    private CacheControl cacheControl() {
        Duration maxAge = properties.cacheMaxAge();
        if (maxAge == null || maxAge.isZero() || maxAge.isNegative()) {
            return CacheControl.noStore();
        }
        return CacheControl.maxAge(maxAge).cachePublic();
    }
}
