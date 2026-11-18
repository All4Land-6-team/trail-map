package com.all4land.trailmap.domain.nearbyplace.controller;

import com.all4land.trailmap.domain.nearbyplace.dto.response.NearbyPlaceResponse;
import com.all4land.trailmap.domain.nearbyplace.service.NearbyPlaceService;
import com.all4land.trailmap.global.response.SuccessResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/v1/courses")
@RequiredArgsConstructor
public class NearbyPlaceController {
    private final NearbyPlaceService service;

    @GetMapping("/{courseId}/nearby-places")
    public SuccessResponse<List<NearbyPlaceResponse>> getNearbyPlaces(@PathVariable long courseId) {
        return SuccessResponse.ok(service.findNearbyPlaces(courseId));
    }
}
