package com.all4land.trailmap.domain.courseroute;

import com.all4land.trailmap.domain.courseroute.exception.CourseRouteException;
import com.all4land.trailmap.domain.courseroute.repository.CourseRouteRepository;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteService;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CourseRouteServiceTest {
    private final CourseRouteRepository repository = mock(CourseRouteRepository.class);
    private final CourseRouteService service = new CourseRouteService(repository);

    @Test
    void validatesBeforeCallingRepository() {
        assertThatThrownBy(() -> service.getCatalog("other")).isInstanceOf(CourseRouteException.class);
        assertThatThrownBy(() -> service.getRoute(0)).isInstanceOf(CourseRouteException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void missingRouteHasDomainNotFound() {
        when(repository.find(99)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getRoute(99)).isInstanceOfSatisfying(CourseRouteException.class,
                error -> assertThat(error.getResponseCode().getHttpStatus()).isEqualTo(404));
    }
}
