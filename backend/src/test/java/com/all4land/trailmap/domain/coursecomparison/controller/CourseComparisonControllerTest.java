package com.all4land.trailmap.domain.coursecomparison.controller;

import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse;
import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse.Metrics;
import com.all4land.trailmap.domain.courseanalysis.entity.AnalysisQualityStatus;
import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.coursecomparison.dto.response.CourseComparisonResponse;
import com.all4land.trailmap.domain.coursecomparison.error.CourseComparisonErrorCode;
import com.all4land.trailmap.domain.coursecomparison.exception.CourseComparisonException;
import com.all4land.trailmap.domain.coursecomparison.service.CourseComparisonService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CourseComparisonController.class)
class CourseComparisonControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean CourseComparisonService service;

    @Test
    void commaSeparatedIdsUseTheCommonResponseWithoutAUserHeader() throws Exception {
        when(service.compare(List.of(2L, 1L))).thenReturn(response());
        mvc.perform(get("/v1/course-comparisons").param("courseIds", "2,1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.httpStatus").value(200)).andExpect(jsonPath("$.data.mountainId").value(7))
                .andExpect(jsonPath("$.data.courses[0].courseId").value(2))
                .andExpect(jsonPath("$.data.courses[1].courseId").value(1))
                .andExpect(jsonPath("$.data.courses[0].analysis.qualityStatus").value("NO_DATA"))
                .andExpect(jsonPath("$.data.courses[0].analysis.metrics.distanceMeters").value(nullValue()))
                .andExpect(jsonPath("$.data.courses[0].analysis.metrics.estimatedDurationSeconds").value(nullValue()))
                .andExpect(jsonPath("$.data.courses[0].analysis.profileUrl").value(nullValue()));
    }

    @Test
    void repeatedQueryParametersKeepTheirOrder() throws Exception {
        when(service.compare(List.of(2L, 1L))).thenReturn(response());
        mvc.perform(get("/v1/course-comparisons").param("courseIds", "2", "1")).andExpect(status().isOk());
        verify(service).compare(List.of(2L, 1L));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1,nope", "1,2.5", "1,1e2", "1,99999999999999999999999"})
    void nonIntegerAndOverflowingIdsUseTheCommonBadRequestResponse(String ids) throws Exception {
        mvc.perform(get("/v1/course-comparisons").param("courseIds", ids)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.code").value("GLOBAL_400_3"));
        verifyNoInteractions(service);
    }

    @Test
    void missingIdsUseTheDomainValidationError() throws Exception {
        when(service.compare(null)).thenThrow(new CourseComparisonException(CourseComparisonErrorCode.INVALID_SELECTION));
        mvc.perform(get("/v1/course-comparisons")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMPARISON_400_1"));
    }

    @Test
    void differentMountainsAndUnknownCoursesUseDistinctErrors() throws Exception {
        when(service.compare(List.of(1L, 2L)))
                .thenThrow(new CourseComparisonException(CourseComparisonErrorCode.DIFFERENT_MOUNTAINS));
        when(service.compare(List.of(1L, 99L)))
                .thenThrow(new CourseComparisonException(CourseComparisonErrorCode.COURSE_NOT_FOUND));
        mvc.perform(get("/v1/course-comparisons").param("courseIds", "1,2")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMPARISON_400_2"));
        mvc.perform(get("/v1/course-comparisons").param("courseIds", "1,99")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPARISON_404_1"));
    }

    @Test
    void corruptAnalysisDoesNotReturnASuccessfulPartialComparison() throws Exception {
        when(service.compare(List.of(1L, 2L)))
                .thenThrow(new CourseAnalysisException(CourseAnalysisErrorCode.DATA_UNAVAILABLE));
        mvc.perform(get("/v1/course-comparisons").param("courseIds", "1,2")).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.code").value("ANALYSIS_503_1"));
    }

    @Test
    void postIsNotSupported() throws Exception {
        mvc.perform(post("/v1/course-comparisons")).andExpect(status().isMethodNotAllowed());
        verifyNoInteractions(service);
    }

    private CourseComparisonResponse response() {
        return new CourseComparisonResponse(7, "북한산", List.of(course(2), course(1)));
    }

    private CourseComparisonResponse.Course course(long id) {
        var analysis = new CourseAnalysisResponse(id, 7, 1, null, null, null, null, null, null,
                AnalysisQualityStatus.NO_DATA, null, List.of("ANALYSIS_NOT_FOUND"), null,
                new Metrics(null, null, null, null, null, null, null), null, null, null);
        return new CourseComparisonResponse.Course(id, "코스 " + id, 1, analysis);
    }
}
