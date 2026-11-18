package com.all4land.trailmap.domain.nearbyplace.client;

import com.all4land.trailmap.domain.nearbyplace.config.KakaoLocalProperties;
import com.all4land.trailmap.domain.nearbyplace.exception.NearbyPlaceException;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

import static com.all4land.trailmap.domain.nearbyplace.error.NearbyPlaceErrorCode.INVALID_UPSTREAM_RESPONSE;
import static com.all4land.trailmap.domain.nearbyplace.error.NearbyPlaceErrorCode.KAKAO_API_NOT_CONFIGURED;
import static com.all4land.trailmap.domain.nearbyplace.error.NearbyPlaceErrorCode.KAKAO_API_UNAVAILABLE;

@Component
public class KakaoRestLocalClient implements KakaoLocalClient {
    private final RestClient restClient;
    private final KakaoLocalProperties properties;

    public KakaoRestLocalClient(@Qualifier("kakaoRestClient") RestClient restClient,
                                KakaoLocalProperties properties) {
        this.restClient = restClient;
        this.properties = properties;
    }

    @Override
    public SearchPage search(String categoryCode, Coordinate center, int page, int size) {
        if (!properties.configured()) throw new NearbyPlaceException(KAKAO_API_NOT_CONFIGURED);
        try {
            var response = restClient.get()
                    .uri(uri -> uri.path("/v2/local/search/category.json")
                            .queryParam("category_group_code", categoryCode)
                            .queryParam("x", center.longitude())
                            .queryParam("y", center.latitude())
                            .queryParam("radius", properties.searchRadiusMeters())
                            .queryParam("sort", "distance")
                            .queryParam("page", page)
                            .queryParam("size", size)
                            .build())
                    .retrieve()
                    .body(KakaoSearchResponse.class);
            if (response == null || response.meta() == null || response.documents() == null) {
                throw new NearbyPlaceException(INVALID_UPSTREAM_RESPONSE);
            }
            return new SearchPage(response.documents().stream().map(document -> map(categoryCode, document)).toList(),
                    response.meta().end());
        } catch (NearbyPlaceException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new NearbyPlaceException(KAKAO_API_UNAVAILABLE);
        } catch (RuntimeException exception) {
            throw new NearbyPlaceException(INVALID_UPSTREAM_RESPONSE);
        }
    }

    private Place map(String requestedCategory, KakaoDocument document) {
        if (document.id() == null || document.id().isBlank() || document.name() == null || document.name().isBlank()) {
            throw new NearbyPlaceException(INVALID_UPSTREAM_RESPONSE);
        }
        double longitude = Double.parseDouble(document.longitude());
        double latitude = Double.parseDouble(document.latitude());
        if (!Double.isFinite(longitude) || Math.abs(longitude) > 180
                || !Double.isFinite(latitude) || Math.abs(latitude) > 90
                || !requestedCategory.equals(document.categoryGroupCode())
                || !document.id().chars().allMatch(Character::isDigit)) {
            throw new NearbyPlaceException(INVALID_UPSTREAM_RESPONSE);
        }
        return new Place(document.id(), document.name(), blank(document.categoryName()), blank(document.categoryGroupCode()),
                blank(document.phone()), blank(document.address()), blank(document.roadAddress()),
                longitude, latitude, "https://place.map.kakao.com/" + document.id());
    }

    private static String blank(String value) {
        return value == null ? "" : value;
    }

    private record KakaoSearchResponse(KakaoMeta meta, List<KakaoDocument> documents) {}

    private record KakaoMeta(@JsonProperty("is_end") boolean end) {}

    private record KakaoDocument(
            String id,
            @JsonProperty("place_name") String name,
            @JsonProperty("category_name") String categoryName,
            @JsonProperty("category_group_code") String categoryGroupCode,
            String phone,
            @JsonProperty("address_name") String address,
            @JsonProperty("road_address_name") String roadAddress,
            @JsonProperty("x") String longitude,
            @JsonProperty("y") String latitude,
            @JsonProperty("place_url") String placeUrl
    ) {}
}
