package com.all4land.trailmap.domain.facility.controller;

import com.all4land.trailmap.domain.facility.dto.response.FacilityResponse;
import com.all4land.trailmap.domain.facility.entity.FacilityType;
import com.all4land.trailmap.domain.facility.service.FacilityService;
import com.all4land.trailmap.global.response.SuccessResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
public class FacilityController {
    private final FacilityService service;

    @GetMapping("/facilities/{facilityId}")
    public SuccessResponse<FacilityResponse> getDetail(@PathVariable Long facilityId) {
        return SuccessResponse.ok(service.getDetail(facilityId));
    }

    @GetMapping("/courses/{courseId}/facilities")
    public SuccessResponse<List<FacilityResponse>> getNearCourse(
            @PathVariable Long courseId,
            @RequestParam(defaultValue = "250") double radiusMeters,
            @RequestParam(required = false) FacilityType type) {
        return SuccessResponse.ok(service.getNearCourse(courseId, radiusMeters, type));
    }
}
