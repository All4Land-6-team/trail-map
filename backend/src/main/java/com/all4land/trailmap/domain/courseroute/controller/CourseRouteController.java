package com.all4land.trailmap.domain.courseroute.controller;

import com.all4land.trailmap.domain.community.dto.response.CommunitySpotMapResponse;
import com.all4land.trailmap.domain.community.entity.CommunitySpotType;
import com.all4land.trailmap.domain.community.service.CommunityQueryService;
import com.all4land.trailmap.domain.courseroute.dto.response.CourseRouteResponse;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteService;
import com.all4land.trailmap.global.response.SuccessResponse;
import com.all4land.trailmap.global.user.CurrentUserId;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
@Validated
public class CourseRouteController {
    private final CourseRouteService service;
    private final CommunityQueryService communityQueryService;

    @GetMapping("/course-routes")
    public SuccessResponse<List<CourseRouteResponse>> getCatalog(@RequestParam(required = false) String mountainKey) {
        return SuccessResponse.ok(service.getCatalog(mountainKey));
    }

    @GetMapping("/courses/{courseId}/route")
    public SuccessResponse<CourseRouteResponse> getRoute(@PathVariable long courseId) {
        return SuccessResponse.ok(service.getRoute(courseId));
    }

    @GetMapping("/courses/{courseId}/spots/map")
    public SuccessResponse<List<CommunitySpotMapResponse>> getCourseSpots(
            @CurrentUserId Long userId,
            @Positive @PathVariable Long courseId,
            @RequestParam(required = false) CommunitySpotType type) {
        return SuccessResponse.ok(communityQueryService.getCourseMapMarkers(userId, courseId, type));
    }
}
