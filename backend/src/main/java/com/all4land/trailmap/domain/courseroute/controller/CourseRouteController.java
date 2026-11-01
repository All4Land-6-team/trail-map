package com.all4land.trailmap.domain.courseroute.controller;

import com.all4land.trailmap.domain.courseroute.dto.response.CourseRouteResponse;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteService;
import com.all4land.trailmap.global.response.SuccessResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
public class CourseRouteController {
    private final CourseRouteService service;

    @GetMapping("/course-routes")
    public SuccessResponse<List<CourseRouteResponse>> getCatalog(@RequestParam(required = false) String mountainKey) {
        return SuccessResponse.ok(service.getCatalog(mountainKey));
    }

    @GetMapping("/courses/{courseId}/route")
    public SuccessResponse<CourseRouteResponse> getRoute(@PathVariable long courseId) {
        return SuccessResponse.ok(service.getRoute(courseId));
    }
}
