package com.all4land.trailmap.domain.nearbyplace.client;

import com.all4land.trailmap.domain.nearbyplace.config.KakaoLocalProperties;
import com.all4land.trailmap.domain.nearbyplace.exception.NearbyPlaceException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class KakaoRestLocalClientTest {

    @Test
    void sendsServerKeyAndParsesKakaoPlaceResponse() {
        var builder = RestClient.builder().baseUrl("https://dapi.kakao.com")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "KakaoAK test-rest-key");
        var server = MockRestServiceServer.bindTo(builder).build();
        var client = new KakaoRestLocalClient(builder.build(), properties("test-rest-key"));
        server.expect(once(), method(HttpMethod.GET))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "KakaoAK test-rest-key"))
                .andExpect(queryParam("category_group_code", "CS2"))
                .andExpect(queryParam("radius", "1000"))
                .andExpect(queryParam("page", "1"))
                .andRespond(withSuccess("""
                        {"meta":{"is_end":true},"documents":[{
                          "id":"101","place_name":"코스 편의점","category_name":"가정,생활 > 편의점",
                          "category_group_code":"CS2","phone":"02-123-4567","address_name":"서울 종로구",
                          "road_address_name":"서울 종로구 길 1","x":"126.9830","y":"37.5666",
                          "place_url":"https://place.map.kakao.com/101"
                        }]}
                        """, MediaType.APPLICATION_JSON));

        var result = client.search("CS2", new KakaoLocalClient.Coordinate(126.98, 37.56), 1, 15);

        assertThat(result.end()).isTrue();
        assertThat(result.places()).singleElement().satisfies(place -> {
            assertThat(place.id()).isEqualTo("101");
            assertThat(place.longitude()).isEqualTo(126.9830);
            assertThat(place.latitude()).isEqualTo(37.5666);
            assertThat(place.placeUrl()).isEqualTo("https://place.map.kakao.com/101");
        });
        server.verify();
    }

    @Test
    void rejectsRequestsWhenServerKeyIsNotConfigured() {
        var client = new KakaoRestLocalClient(RestClient.create(), properties("not-configured"));

        assertThatThrownBy(() -> client.search("CS2", new KakaoLocalClient.Coordinate(126.98, 37.56), 1, 15))
                .isInstanceOf(NearbyPlaceException.class)
                .hasMessageContaining("주변 장소 검색 설정이 준비되지 않았습니다");
    }

    @Test
    void rejectsInvalidCoordinatesFromKakao() {
        var builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        var server = MockRestServiceServer.bindTo(builder).build();
        var client = new KakaoRestLocalClient(builder.build(), properties("test-rest-key"));
        server.expect(once(), method(HttpMethod.GET)).andRespond(withSuccess("""
                {"meta":{"is_end":true},"documents":[{
                  "id":"101","place_name":"잘못된 장소","category_group_code":"CS2",
                  "x":"NaN","y":"37.5666","place_url":"https://place.map.kakao.com/101"
                }]}
                """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.search("CS2", new KakaoLocalClient.Coordinate(126.98, 37.56), 1, 15))
                .isInstanceOf(NearbyPlaceException.class)
                .hasMessageContaining("응답을 처리할 수 없습니다");
        server.verify();
    }

    private static KakaoLocalProperties properties(String key) {
        return new KakaoLocalProperties(key, "https://dapi.kakao.com",
                Duration.ofSeconds(2), Duration.ofSeconds(3), Duration.ofSeconds(10),
                1_000, 500, 900, 8, 2, 4, Duration.ofMinutes(10));
    }
}
