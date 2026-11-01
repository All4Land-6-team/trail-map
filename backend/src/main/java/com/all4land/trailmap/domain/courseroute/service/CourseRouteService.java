package com.all4land.trailmap.domain.courseroute.service;

import com.all4land.trailmap.domain.courseroute.dto.response.CourseRouteResponse;
import com.all4land.trailmap.domain.courseroute.exception.CourseRouteException;
import com.all4land.trailmap.domain.courseroute.repository.CourseRouteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import static com.all4land.trailmap.domain.courseroute.error.CourseRouteErrorCode.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CourseRouteService {
    private final CourseRouteRepository repository;

    public List<CourseRouteResponse> getCatalog(String mountainKey) {
        if (!"bukhansan".equals(mountainKey) && !"dobongsan".equals(mountainKey)) throw new CourseRouteException(INVALID_REQUEST);
        return repository.findCatalog(mountainKey);
    }

    public CourseRouteResponse getRoute(long courseId) {
        if (courseId <= 0) throw new CourseRouteException(INVALID_REQUEST);
        return repository.find(courseId).orElseThrow(() -> new CourseRouteException(NOT_FOUND));
    }
}
