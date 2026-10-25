package com.all4land.trailmap.domain.facility.controller;

import com.all4land.trailmap.domain.facility.dto.response.FacilityFeatureCollection;
import com.all4land.trailmap.domain.facility.entity.FacilityType;
import com.all4land.trailmap.domain.facility.service.FacilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

/** 지역 확정 전 후보를 확인하는 로컬 개발용 엔드포인트. 기본 설정에서는 비활성화된다. */
@RestController
@RequestMapping("/v1/facilities/review")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "facility.review.enabled", havingValue = "true")
public class FacilityReviewController {
    private final FacilityService service;

    @GetMapping(produces = "application/geo+json")
    public FacilityFeatureCollection getReview(@RequestParam(required = false) Long sourceId,
                                              @RequestParam(required = false) FacilityType type) {
        return FacilityFeatureCollection.from(service.getReview(sourceId, type));
    }
}
