package com.all4land.trailmap.domain.courseanalysis.controller;

import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisProfileResponse;
import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisService;
import com.all4land.trailmap.global.response.SuccessResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
public class CourseAnalysisController {
    private final CourseAnalysisService service;

    @GetMapping("/courses/{courseId}/analysis")
    public SuccessResponse<CourseAnalysisResponse> getSummary(@PathVariable long courseId) {
        return SuccessResponse.ok(service.getSummary(courseId));
    }

    @GetMapping("/course-analyses/{analysisId}/profile")
    public SuccessResponse<CourseAnalysisProfileResponse> getProfile(@PathVariable long analysisId) {
        return SuccessResponse.ok(service.getProfile(analysisId));
    }
}
