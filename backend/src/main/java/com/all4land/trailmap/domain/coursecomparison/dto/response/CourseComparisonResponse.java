package com.all4land.trailmap.domain.coursecomparison.dto.response;

import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse;

import java.util.List;

public record CourseComparisonResponse(long mountainId, String mountainName, List<Course> courses) {
    /** 현재 코스 정보와 분석 당시의 버전·품질은 analysis 안에서 구분한다. */
    public record Course(long courseId, String courseName, int currentCourseVersion,
                         CourseAnalysisResponse analysis) {}
}
