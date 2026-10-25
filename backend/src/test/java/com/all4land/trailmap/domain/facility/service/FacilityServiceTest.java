package com.all4land.trailmap.domain.facility.service;

import com.all4land.trailmap.domain.facility.exception.FacilityException;
import com.all4land.trailmap.domain.facility.repository.FacilityRepository;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class FacilityServiceTest {
    private final FacilityRepository repository = mock(FacilityRepository.class);
    private final FacilityService service = new FacilityService(repository);

    @Test
    void invalidRadiusAndIdentifiersNeverReachTheDatabase() {
        for (double radius : new double[]{Double.NaN, Double.POSITIVE_INFINITY, 0, -1, 5001}) {
            assertThatThrownBy(() -> service.getNearCourse(1L, radius, null)).isInstanceOf(FacilityException.class);
        }
        assertThatThrownBy(() -> service.getReview(null, null)).isInstanceOf(FacilityException.class);
        assertThatThrownBy(() -> service.getDetail(-1L)).isInstanceOf(FacilityException.class);
        verifyNoInteractions(repository);
    }
}
