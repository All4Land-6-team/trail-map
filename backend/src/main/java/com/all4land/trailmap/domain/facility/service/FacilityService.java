package com.all4land.trailmap.domain.facility.service;

import com.all4land.trailmap.domain.facility.dto.response.FacilityResponse;
import com.all4land.trailmap.domain.facility.entity.FacilityType;
import com.all4land.trailmap.domain.facility.error.FacilityErrorCode;
import com.all4land.trailmap.domain.facility.exception.FacilityException;
import com.all4land.trailmap.domain.facility.repository.FacilityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FacilityService {
    private final FacilityRepository repository;

    public FacilityResponse getDetail(Long facilityId) {
        requireId(facilityId);
        return repository.findById(facilityId)
                .orElseThrow(() -> new FacilityException(FacilityErrorCode.FACILITY_NOT_FOUND));
    }

    public List<FacilityResponse> getReview(Long sourceId, FacilityType type) {
        requireId(sourceId);
        if (!repository.existsSource(sourceId)) {
            throw new FacilityException(FacilityErrorCode.SOURCE_NOT_FOUND);
        }
        return repository.findBySource(sourceId, type);
    }

    public List<FacilityResponse> getNearCourse(Long courseId, double radiusMeters, FacilityType type) {
        requireId(courseId);
        if (!Double.isFinite(radiusMeters) || radiusMeters < 1 || radiusMeters > 5000) {
            throw new FacilityException(FacilityErrorCode.INVALID_QUERY);
        }
        if (!repository.existsCourse(courseId)) {
            throw new FacilityException(FacilityErrorCode.COURSE_NOT_FOUND);
        }
        return repository.findNearCourse(courseId, radiusMeters, type);
    }

    private static void requireId(Long id) {
        if (id == null || id <= 0) {
            throw new FacilityException(FacilityErrorCode.INVALID_QUERY);
        }
    }
}
