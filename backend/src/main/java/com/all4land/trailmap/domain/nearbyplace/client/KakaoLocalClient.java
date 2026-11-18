package com.all4land.trailmap.domain.nearbyplace.client;

import java.util.List;

public interface KakaoLocalClient {

    SearchPage search(String categoryCode, Coordinate center, int page, int size);

    record Coordinate(double longitude, double latitude) {}

    record SearchPage(List<Place> places, boolean end) {}

    record Place(
            String id,
            String name,
            String categoryName,
            String categoryGroupCode,
            String phone,
            String address,
            String roadAddress,
            double longitude,
            double latitude,
            String placeUrl
    ) {}
}
