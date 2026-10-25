package com.all4land.trailmap.global.config.r2;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "r2")
public record R2Properties(
        String bucketName,
        String accessKeyId,
        String secretAccessKey,
        String endpoint,
        Duration uploadUrlExpiration,
        Duration readUrlExpiration
) {
}
