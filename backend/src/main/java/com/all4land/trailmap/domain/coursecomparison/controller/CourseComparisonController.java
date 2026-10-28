package com.all4land.trailmap.domain.coursecomparison.controller;

import com.all4land.trailmap.domain.coursecomparison.dto.response.CourseComparisonResponse;
import com.all4land.trailmap.domain.coursecomparison.service.CourseComparisonService;
import com.all4land.trailmap.global.response.SuccessResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/v1/course-comparisons")
@RequiredArgsConstructor
public class CourseComparisonController {
    private final CourseComparisonService service;

    @GetMapping
    public SuccessResponse<CourseComparisonResponse> compare(
            @RequestParam(required = false) List<Long> courseIds) {
        return SuccessResponse.ok(service.compare(courseIds));
    }
}
