package com.all4land.trailmap.domain.courseanalysis.controller;

import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisProfileResponse;
import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse;
import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse.Metrics;
import com.all4land.trailmap.domain.courseanalysis.entity.AnalysisQualityStatus;
import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CourseAnalysisController.class)
class CourseAnalysisControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean CourseAnalysisService service;

    @Test
    void summaryUsesCommonResponseAndPreservesNullMeasurementsWithoutUserHeader() throws Exception {
        when(service.getSummary(1)).thenReturn(noData());
        mvc.perform(get("/v1/courses/1/analysis")).andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.httpStatus").value(200))
                .andExpect(jsonPath("$.data.qualityStatus").value("NO_DATA"))
                .andExpect(jsonPath("$.data.metrics.distanceMeters").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void profilePreservesUnknownSlopeAndCoordinates() throws Exception {
        when(service.getProfile(7)).thenReturn(new CourseAnalysisProfileResponse(noData(), List.of(
                new CourseAnalysisProfileResponse.Sample(0, 0, List.of(126.9, 37.6), 100.0, null, "VALID"))));
        mvc.perform(get("/v1/course-analyses/7/profile")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.samples[0].coordinate[0]").value(126.9))
                .andExpect(jsonPath("$.data.samples[0].slopePercent").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void domainNotFoundAndUnavailableUseCommonErrorResponse() throws Exception {
        when(service.getSummary(1)).thenThrow(new CourseAnalysisException(CourseAnalysisErrorCode.COURSE_NOT_FOUND));
        when(service.getProfile(7)).thenThrow(new CourseAnalysisException(CourseAnalysisErrorCode.DATA_UNAVAILABLE));
        mvc.perform(get("/v1/courses/1/analysis")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_404_1"));
        mvc.perform(get("/v1/course-analyses/7/profile")).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("ANALYSIS_503_1"));
    }

    @Test
    void malformedIdsAreBadRequestsAndPublicWritesAreNotSupported() throws Exception {
        mvc.perform(get("/v1/courses/not-a-number/analysis")).andExpect(status().isBadRequest());
        mvc.perform(get("/v1/course-analyses/999999999999999999999999/profile")).andExpect(status().isBadRequest());
        mvc.perform(post("/v1/courses/1/analysis")).andExpect(status().isMethodNotAllowed());
        verifyNoInteractions(service);
    }

    private CourseAnalysisResponse noData() {
        return new CourseAnalysisResponse(1, 2, 1, null, null, null, null, null, null,
                AnalysisQualityStatus.NO_DATA, null, List.of("ANALYSIS_NOT_FOUND"), null,
                new Metrics(null, null, null, null, null, null, null), null, null, null);
    }
}
