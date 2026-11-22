package com.all4land.trailmap.domain.community.weather;

import com.all4land.trailmap.domain.community.repository.review.CommunityReviewEnvironmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
class ReviewEnvironmentWeatherListener {

    private final ReviewEnvironmentService environmentService;
    private final CommunityReviewEnvironmentRepository environmentRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void enrich(ReviewEnvironmentWeatherRequest request) {
        environmentRepository.updateWeather(request.kind(), request.reviewId(), environmentService.resolve(request));
    }
}
