package com.all4land.trailmap.domain.community.weather;

import com.all4land.trailmap.global.config.weather.KmaProperties;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class ReviewEnvironmentService {

    private static final Logger log = LoggerFactory.getLogger(ReviewEnvironmentService.class);

    private final KmaProperties properties;
    private final KmaWeatherClient client;
    private final MountainAsosStationRepository stationRepository;

    public ReviewEnvironment resolve(ReviewEnvironmentWeatherRequest request) {
        if (!properties.configured()) {
            log.warn("후기 날씨를 조회하지 않았습니다: KMA_API_AUTH_KEY가 설정되지 않았습니다.");
            return failed(request);
        }
        var gridFuture = weatherCall(
                () -> client.getGridObservation(request.referenceAt(), request.longitude(), request.latitude()),
                "고해상도 격자"
        );
        Integer stationId = stationRepository.findStationId(request.mountainId()).orElse(null);
        var asosFuture = stationId == null
                ? CompletableFuture.completedFuture(Optional.<KmaAsosObservation>empty())
                : weatherCall(() -> client.getAsosObservation(request.referenceAt(), stationId), "ASOS");
        KmaGridObservation grid = gridFuture.join().orElse(null);
        KmaAsosObservation asos = asosFuture.join().orElse(null);
        WeatherStatus status = grid == null && asos == null ? WeatherStatus.FAILED : WeatherStatus.SUCCESS;
        return new ReviewEnvironment(
                request.referenceAt(),
                request.utcOffsetMinutes(),
                request.longitude(),
                request.latitude(),
                status,
                grid == null ? null : grid.temperatureC(),
                WeatherClassifier.classify(grid, asos)
        );
    }

    private <T> CompletableFuture<Optional<T>> weatherCall(Supplier<Optional<T>> call, String label) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return call.get();
            } catch (RuntimeException error) {
                log.warn("후기의 {} 날씨를 조회하지 못했습니다: {}", label, error.getMessage());
                return Optional.empty();
            }
        });
    }

    private static ReviewEnvironment failed(ReviewEnvironmentWeatherRequest request) {
        return new ReviewEnvironment(
                request.referenceAt(), request.utcOffsetMinutes(), request.longitude(), request.latitude(),
                WeatherStatus.FAILED, null, null
        );
    }
}
