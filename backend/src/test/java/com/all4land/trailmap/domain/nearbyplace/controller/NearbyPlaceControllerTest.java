package com.all4land.trailmap.domain.nearbyplace.controller;

import com.all4land.trailmap.domain.courseroute.dto.response.CourseRouteResponse;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteService;
import com.all4land.trailmap.domain.nearbyplace.client.KakaoLocalClient;
import com.all4land.trailmap.domain.nearbyplace.config.KakaoLocalProperties;
import com.all4land.trailmap.domain.nearbyplace.service.NearbyPlaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.Executor;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NearbyPlaceController.class)
@Import({NearbyPlaceService.class, NearbyPlaceControllerTest.ExecutorConfig.class})
class NearbyPlaceControllerTest {

    @TestConfiguration
    static class ExecutorConfig {
        @Bean("kakaoSearchExecutor")
        Executor kakaoSearchExecutor() {
            return Runnable::run;
        }
    }

    @Autowired MockMvc mockMvc;
    @MockitoBean CourseRouteService routeService;
    @MockitoBean KakaoLocalClient client;
    @MockitoBean KakaoLocalProperties properties;

    @BeforeEach
    void configurePolicy() {
        when(properties.maxPages()).thenReturn(2);
        when(properties.maxSamplePoints()).thenReturn(8);
        when(properties.sampleIntervalMeters()).thenReturn(900.0);
        when(properties.maxDistanceFromCourseMeters()).thenReturn(500);
        when(properties.cacheTtl()).thenReturn(Duration.ofMinutes(10));
        when(properties.requestTimeout()).thenReturn(Duration.ofSeconds(10));
    }

    @Test
    void returnsCourseNearbyPlacesWithoutExposingApiKey() throws Exception {
        when(routeService.getRoute(7L)).thenReturn(new CourseRouteResponse(
                7L, 2L, "bukhansan", "테스트 코스", 1, "테스트 구간", 1000,
                null, null, null,
                new CourseRouteResponse.Geometry("LineString", List.of(
                        List.of(126.9780, 37.5665), List.of(126.9880, 37.5665))),
                new CourseRouteResponse.Source("source", "provider", null, "v1", "7", "VALIDATED", ""), null));
        when(client.search(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt()))
                .thenReturn(new KakaoLocalClient.SearchPage(List.of(new KakaoLocalClient.Place(
                        "101", "코스 편의점", "편의점", "CS2", "02-123-4567",
                        "서울 종로구", "서울 종로구 길 1", 126.9830, 37.5666,
                        "https://place.map.kakao.com/101")), true));

        mockMvc.perform(get("/v1/courses/7/nearby-places"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].sourceType").value("KAKAO_PLACE"))
                .andExpect(jsonPath("$.data[0].placeId").value("101"))
                .andExpect(jsonPath("$.data[0].distanceFromCourseMeters").isNumber())
                .andExpect(jsonPath("$..apiKey").doesNotExist());
    }

}
