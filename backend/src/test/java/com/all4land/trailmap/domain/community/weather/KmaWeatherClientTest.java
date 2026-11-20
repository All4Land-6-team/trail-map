package com.all4land.trailmap.domain.community.weather;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class KmaWeatherClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 기상청_결측_기온은_저장하지_않는다() throws Exception {
        assertThat(KmaWeatherClient.temperature(objectMapper.readTree("{\"ta\":-999}"))).isNull();
        assertThat(KmaWeatherClient.temperature(objectMapper.readTree("{\"ta\":12.3}"))).isEqualTo(12.3);
    }
}
