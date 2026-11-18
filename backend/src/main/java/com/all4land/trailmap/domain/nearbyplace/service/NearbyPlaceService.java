package com.all4land.trailmap.domain.nearbyplace.service;

import com.all4land.trailmap.domain.courseroute.service.CourseRouteService;
import com.all4land.trailmap.domain.nearbyplace.client.KakaoLocalClient;
import com.all4land.trailmap.domain.nearbyplace.client.KakaoLocalClient.Coordinate;
import com.all4land.trailmap.domain.nearbyplace.client.KakaoLocalClient.Place;
import com.all4land.trailmap.domain.nearbyplace.config.KakaoLocalProperties;
import com.all4land.trailmap.domain.nearbyplace.dto.response.NearbyPlaceResponse;
import com.all4land.trailmap.domain.nearbyplace.exception.NearbyPlaceException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static com.all4land.trailmap.domain.nearbyplace.error.NearbyPlaceErrorCode.COURSE_COVERAGE_LIMIT_EXCEEDED;
import static com.all4land.trailmap.domain.nearbyplace.error.NearbyPlaceErrorCode.KAKAO_API_UNAVAILABLE;

@Service
public class NearbyPlaceService {
    private static final List<String> CATEGORY_CODES = List.of("CS2", "FD6", "CE7");
    private static final int PAGE_SIZE = 15;
    private static final double EARTH_RADIUS_METERS = 6_371_000;

    private final CourseRouteService routeService;
    private final KakaoLocalClient client;
    private final KakaoLocalProperties properties;
    private final Executor searchExecutor;
    private final Map<Long, CacheEntry> cache = new ConcurrentHashMap<>();
    private final Map<Long, CompletableFuture<List<NearbyPlaceResponse>>> inFlight = new ConcurrentHashMap<>();

    public NearbyPlaceService(CourseRouteService routeService,
                              KakaoLocalClient client,
                              KakaoLocalProperties properties,
                              @Qualifier("kakaoSearchExecutor") Executor searchExecutor) {
        this.routeService = routeService;
        this.client = client;
        this.properties = properties;
        this.searchExecutor = searchExecutor;
    }

    public List<NearbyPlaceResponse> findNearbyPlaces(long courseId) {
        var cached = cache.get(courseId);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) return cached.places();

        var pending = new CompletableFuture<List<NearbyPlaceResponse>>();
        var existing = inFlight.putIfAbsent(courseId, pending);
        if (existing != null) return await(existing);
        try {
            cached = cache.get(courseId);
            var places = cached != null && cached.expiresAt().isAfter(Instant.now()) ? cached.places() : load(courseId);
            pending.complete(places);
            return places;
        } catch (RuntimeException exception) {
            pending.completeExceptionally(exception);
            throw exception;
        } finally {
            inFlight.remove(courseId, pending);
        }
    }

    private static List<NearbyPlaceResponse> await(CompletableFuture<List<NearbyPlaceResponse>> future) {
        try {
            return future.join();
        } catch (CompletionException exception) {
            if (exception.getCause() instanceof RuntimeException cause) throw cause;
            throw exception;
        }
    }

    private List<NearbyPlaceResponse> load(long courseId) {
        var route = routeService.getRoute(courseId).geometry().coordinates().stream()
                .map(point -> new Coordinate(point.get(0), point.get(1)))
                .toList();
        var searches = new ArrayList<CompletableFuture<List<Place>>>();
        for (var sample : sample(route)) {
            for (var category : CATEGORY_CODES) {
                searches.add(CompletableFuture.supplyAsync(() -> search(sample, category), searchExecutor));
            }
        }
        var unique = new LinkedHashMap<String, Place>();
        try {
            CompletableFuture.allOf(searches.toArray(CompletableFuture[]::new))
                    .get(properties.requestTimeout().toMillis(), TimeUnit.MILLISECONDS);
            searches.stream().flatMap(future -> future.join().stream())
                    .forEach(place -> unique.putIfAbsent(place.id(), place));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            cancel(searches);
            throw new NearbyPlaceException(KAKAO_API_UNAVAILABLE);
        } catch (ExecutionException | TimeoutException exception) {
            cancel(searches);
            var cause = exception instanceof ExecutionException ? exception.getCause() : null;
            if (cause instanceof NearbyPlaceException nearbyPlaceException) throw nearbyPlaceException;
            throw new NearbyPlaceException(KAKAO_API_UNAVAILABLE);
        }

        var places = unique.values().stream()
                .map(place -> new Candidate(place, distanceToRoute(place, route)))
                .filter(candidate -> candidate.distanceMeters() <= properties.maxDistanceFromCourseMeters())
                .map(candidate -> response(candidate.place(), candidate.distanceMeters()))
                .sorted(Comparator.comparingInt(NearbyPlaceResponse::distanceFromCourseMeters)
                        .thenComparing(NearbyPlaceResponse::name))
                .toList();
        cache.put(courseId, new CacheEntry(places, Instant.now().plus(properties.cacheTtl())));
        return places;
    }

    private List<Place> search(Coordinate sample, String category) {
        var places = new ArrayList<Place>();
        for (int page = 1; page <= properties.maxPages(); page++) {
            var result = client.search(category, sample, page, PAGE_SIZE);
            places.addAll(result.places());
            if (result.end()) break;
        }
        return List.copyOf(places);
    }

    private static void cancel(List<? extends CompletableFuture<?>> searches) {
        searches.forEach(search -> search.cancel(true));
    }

    private static NearbyPlaceResponse response(Place place, double distance) {
        return new NearbyPlaceResponse("KAKAO_PLACE", place.id(), place.name(), category(place.categoryGroupCode()),
                place.longitude(), place.latitude(), place.address(), place.roadAddress(), place.phone(), place.placeUrl(),
                (int) Math.round(distance));
    }

    private static String category(String code) {
        return switch (code) {
            case "CS2" -> "CONVENIENCE_STORE";
            case "FD6" -> "RESTAURANT";
            case "CE7" -> "CAFE";
            default -> "OTHER";
        };
    }

    List<Coordinate> sample(List<Coordinate> route) {
        if (route.size() < 2) return route;
        var lengths = new ArrayList<Double>(route.size());
        lengths.add(0.0);
        double total = 0;
        for (int index = 1; index < route.size(); index++) {
            total += haversine(route.get(index - 1), route.get(index));
            lengths.add(total);
        }
        int requiredForCoverage = Math.max(2,
                (int) Math.ceil(total / (properties.searchRadiusMeters() * 2.0)) + 1);
        int desiredCount = Math.max(requiredForCoverage,
                (int) Math.ceil(total / properties.sampleIntervalMeters()) + 1);
        if (desiredCount > properties.maxSamplePoints()) {
            throw new NearbyPlaceException(COURSE_COVERAGE_LIMIT_EXCEEDED);
        }
        int count = desiredCount;
        var sampled = new ArrayList<Coordinate>(count);
        int segment = 1;
        for (int index = 0; index < count; index++) {
            double target = total * index / (count - 1);
            while (segment < lengths.size() - 1 && lengths.get(segment) < target) segment++;
            double startDistance = lengths.get(segment - 1);
            double segmentLength = lengths.get(segment) - startDistance;
            double ratio = segmentLength == 0 ? 0 : (target - startDistance) / segmentLength;
            var start = route.get(segment - 1);
            var end = route.get(segment);
            sampled.add(new Coordinate(
                    start.longitude() + (end.longitude() - start.longitude()) * ratio,
                    start.latitude() + (end.latitude() - start.latitude()) * ratio));
        }
        return List.copyOf(sampled);
    }

    private static double distanceToRoute(Place place, List<Coordinate> route) {
        if (route.size() == 1) return haversine(new Coordinate(place.longitude(), place.latitude()), route.getFirst());
        double minimum = Double.MAX_VALUE;
        for (int index = 1; index < route.size(); index++) {
            minimum = Math.min(minimum, distanceToSegment(place.longitude(), place.latitude(),
                    route.get(index - 1), route.get(index)));
        }
        return minimum;
    }

    private static double distanceToSegment(double longitude, double latitude, Coordinate start, Coordinate end) {
        double latitudeRadians = Math.toRadians(latitude);
        double startX = Math.toRadians(start.longitude() - longitude) * Math.cos(latitudeRadians) * EARTH_RADIUS_METERS;
        double startY = Math.toRadians(start.latitude() - latitude) * EARTH_RADIUS_METERS;
        double endX = Math.toRadians(end.longitude() - longitude) * Math.cos(latitudeRadians) * EARTH_RADIUS_METERS;
        double endY = Math.toRadians(end.latitude() - latitude) * EARTH_RADIUS_METERS;
        double deltaX = endX - startX;
        double deltaY = endY - startY;
        double lengthSquared = deltaX * deltaX + deltaY * deltaY;
        double ratio = lengthSquared == 0 ? 0 : Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared));
        return Math.hypot(startX + ratio * deltaX, startY + ratio * deltaY);
    }

    private static double haversine(Coordinate first, Coordinate second) {
        double deltaLatitude = Math.toRadians(second.latitude() - first.latitude());
        double deltaLongitude = Math.toRadians(second.longitude() - first.longitude());
        double startLatitude = Math.toRadians(first.latitude());
        double endLatitude = Math.toRadians(second.latitude());
        double value = Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2)
                + Math.cos(startLatitude) * Math.cos(endLatitude)
                * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);
        return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    }

    private record CacheEntry(List<NearbyPlaceResponse> places, Instant expiresAt) {}

    private record Candidate(Place place, double distanceMeters) {}
}
