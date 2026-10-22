package com.all4land.trailmap.global.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;
import java.time.Duration;

@ConfigurationProperties(prefix = "terrain")
public record TerrainProperties(
        Path rootPath,
        Duration cacheMaxAge,
        String tilesUrl
) {
}
