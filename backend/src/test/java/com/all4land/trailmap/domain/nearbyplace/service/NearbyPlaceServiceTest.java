package com.all4land.trailmap.domain.nearbyplace.service;

import com.all4land.trailmap.domain.courseroute.dto.response.CourseRouteResponse;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteService;
import com.all4land.trailmap.domain.nearbyplace.client.KakaoLocalClient;
import com.all4land.trailmap.domain.nearbyplace.config.KakaoLocalProperties;
import com.all4land.trailmap.domain.nearbyplace.dto.response.NearbyPlaceResponse;
import com.all4land.trailmap.domain.nearbyplace.exception.NearbyPlaceException;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NearbyPlaceServiceTest {

    private final CourseRouteService routeService = mock(CourseRouteService.class);
    private final KakaoLocalClient client = mock(KakaoLocalClient.class);
    private final NearbyPlaceService service = new NearbyPlaceService(routeService, client, properties(), Runnable::run);

    @Test
    void removesDuplicateKakaoIdsAndPlacesOutsideCourseDistanceThenCachesResult() {
        when(routeService.getRoute(7L)).thenReturn(route(List.of(
                List.of(126.9780, 37.5665),
                List.of(126.9880, 37.5665)
        )));
        var near = new KakaoLocalClient.Place(
                "101", "코스 편의점", "편의점", "CS2", "02-123-4567",
                "서울 종로구", "서울 종로구 길 1", 126.9830, 37.5666,
                "https://place.map.kakao.com/101"
        );
        var far = new KakaoLocalClient.Place(
                "202", "먼 카페", "카페", "CE7", "", "서울 강남구", "",
                127.1000, 37.7000, "https://place.map.kakao.com/202"
        );
        var justOutsideBoundary = new KakaoLocalClient.Place(
                "203", "경계 밖 음식점", "음식점", "FD6", "", "서울 종로구", "",
                126.9830, 37.5710, "https://place.map.kakao.com/203"
        );
        when(client.search(anyString(), any(), anyInt(), anyInt()))
                .thenReturn(new KakaoLocalClient.SearchPage(List.of(near, near, far, justOutsideBoundary), true));

        List<NearbyPlaceResponse> first = service.findNearbyPlaces(7L);
        int firstCallCount = org.mockito.Mockito.mockingDetails(client).getInvocations().size();
        List<NearbyPlaceResponse> cached = service.findNearbyPlaces(7L);

        assertThat(first).hasSize(1);
        assertThat(first.getFirst().placeId()).isEqualTo("101");
        assertThat(first.getFirst().sourceType()).isEqualTo("KAKAO_PLACE");
        assertThat(first.getFirst().distanceFromCourseMeters()).isBetween(0, 500);
        assertThat(cached).isEqualTo(first);
        verify(routeService, times(1)).getRoute(7L);
        verify(client, times(firstCallCount)).search(anyString(), any(), anyInt(), anyInt());
    }

    @Test
    void mergesConcurrentColdRequestsForTheSameCourse() throws Exception {
        when(routeService.getRoute(7L)).thenReturn(route(List.of(
                List.of(126.9780, 37.5665), List.of(126.9880, 37.5665))));
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        when(client.search(anyString(), any(), anyInt(), anyInt())).thenAnswer(invocation -> {
            entered.countDown();
            assertThat(release.await(2, TimeUnit.SECONDS)).isTrue();
            return new KakaoLocalClient.SearchPage(List.of(), true);
        });

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> service.findNearbyPlaces(7L));
            assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue();
            var second = executor.submit(() -> service.findNearbyPlaces(7L));
            release.countDown();

            assertThat(first.get(2, TimeUnit.SECONDS)).isEmpty();
            assertThat(second.get(2, TimeUnit.SECONDS)).isEmpty();
        }

        verify(routeService, times(1)).getRoute(7L);
    }

    @Test
    void samplesMiddlePointsForLongTwoPointRoute() {
        var sampled = service.sample(List.of(
                new KakaoLocalClient.Coordinate(126.9780, 37.5665),
                new KakaoLocalClient.Coordinate(127.0100, 37.5665)));

        assertThat(sampled).hasSizeGreaterThan(2);
        assertThat(sampled.getFirst().longitude()).isEqualTo(126.9780);
        assertThat(sampled.getLast().longitude()).isEqualTo(127.0100);
    }

    @Test
    void sharesOneFailureAcrossOverlappingRequests() throws Exception {
        when(routeService.getRoute(9L)).thenReturn(route(List.of(
                List.of(126.9780, 37.5665), List.of(126.9880, 37.5665))));
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        when(client.search(anyString(), any(), anyInt(), anyInt())).thenAnswer(invocation -> {
            entered.countDown();
            assertThat(release.await(2, TimeUnit.SECONDS)).isTrue();
            throw new NearbyPlaceException(
                    com.all4land.trailmap.domain.nearbyplace.error.NearbyPlaceErrorCode.KAKAO_API_UNAVAILABLE);
        });

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> service.findNearbyPlaces(9L));
            assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue();
            var second = executor.submit(() -> service.findNearbyPlaces(9L));
            release.countDown();

            assertThatThrownBy(() -> first.get(2, TimeUnit.SECONDS)).hasCauseInstanceOf(NearbyPlaceException.class);
            assertThatThrownBy(() -> second.get(2, TimeUnit.SECONDS)).hasCauseInstanceOf(NearbyPlaceException.class);
        }

        verify(routeService, times(1)).getRoute(9L);
    }

    private static CourseRouteResponse route(List<List<Double>> coordinates) {
        return new CourseRouteResponse(7L, 2L, "bukhansan", "테스트 코스", 1,
                "테스트 구간", 1000, null, null, null,
                new CourseRouteResponse.Geometry("LineString", coordinates),
                new CourseRouteResponse.Source("source", "provider", null, "v1", "7", "VALIDATED", ""),
                null);
    }

    private static KakaoLocalProperties properties() {
        return new KakaoLocalProperties("test-key", "https://dapi.kakao.com",
                Duration.ofSeconds(2), Duration.ofSeconds(3), Duration.ofSeconds(10),
                1_000, 500, 900, 8, 2, 4, Duration.ofMinutes(10));
    }
}
