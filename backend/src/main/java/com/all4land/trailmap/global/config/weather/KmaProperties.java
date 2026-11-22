package com.all4land.trailmap.global.config.weather;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "weather.kma")
public record KmaProperties(String baseUrl, String authKey) {

    public boolean configured() {
        return authKey != null && !authKey.isBlank() && !"not-configured".equals(authKey);
    }
}
