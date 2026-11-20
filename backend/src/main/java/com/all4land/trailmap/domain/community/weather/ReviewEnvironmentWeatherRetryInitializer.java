package com.all4land.trailmap.domain.community.weather;

import com.all4land.trailmap.domain.community.repository.review.CommunityReviewEnvironmentRepository;
import com.all4land.trailmap.global.config.weather.KmaProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(1)
@RequiredArgsConstructor
class ReviewEnvironmentWeatherRetryInitializer implements ApplicationRunner {

    private static final int RETRY_LIMIT = 100;

    private final KmaProperties properties;
    private final CommunityReviewEnvironmentRepository repository;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    public void run(ApplicationArguments args) {
        if (!properties.configured()) return;
        repository.findRetryCandidates(RETRY_LIMIT).forEach(eventPublisher::publishEvent);
    }
}
