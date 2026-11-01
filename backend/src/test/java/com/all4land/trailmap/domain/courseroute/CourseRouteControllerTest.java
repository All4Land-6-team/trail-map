package com.all4land.trailmap.domain.courseroute;

import com.all4land.trailmap.domain.courseroute.controller.CourseRouteController;
import com.all4land.trailmap.domain.courseroute.dto.response.CourseRouteResponse;
import com.all4land.trailmap.domain.courseroute.exception.CourseRouteException;
import com.all4land.trailmap.domain.courseroute.service.CourseRouteService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.util.List;
import static com.all4land.trailmap.domain.courseroute.error.CourseRouteErrorCode.*;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CourseRouteController.class)
class CourseRouteControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean CourseRouteService service;

    @Test
    void servesWgs84GeometryAndUnknownValuesWithoutUserHeader() throws Exception {
        var route = new CourseRouteResponse(42, 2, "bukhansan", "후보", 1, "시작~정상", 1234.5,
                2000.0, null, null, new CourseRouteResponse.Geometry("LineString", List.of(List.of(127.0, 37.7), List.of(127.001, 37.701))),
                new CourseRouteResponse.Source("후보 데이터", null, null, "hash", "BUKHAN_01", "candidate_smap_unverified", "확인 필요"));
        when(service.getRoute(42)).thenReturn(route);
        when(service.getCatalog("bukhansan")).thenReturn(List.of(route));
        mvc.perform(get("/v1/courses/42/route")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.geometry.type").value("LineString"))
                .andExpect(jsonPath("$.data.geometry.coordinates[0][0]").value(127.0))
                .andExpect(jsonPath("$.data.distanceMeters").value(1234.5))
                .andExpect(jsonPath("$.data.difficulty").value(nullValue()))
                .andExpect(jsonPath("$.data.durationSeconds").value(nullValue()))
                .andExpect(jsonPath("$.data.source.validationStatus").value("candidate_smap_unverified"));
        mvc.perform(get("/v1/course-routes").param("mountainKey", "bukhansan"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].courseId").value(42));
    }

    @Test
    void invalidMissingAndUnknownIdentifiersUseCommonErrors() throws Exception {
        when(service.getRoute(0)).thenThrow(new CourseRouteException(INVALID_REQUEST));
        when(service.getRoute(-1)).thenThrow(new CourseRouteException(INVALID_REQUEST));
        when(service.getRoute(99)).thenThrow(new CourseRouteException(NOT_FOUND));
        when(service.getCatalog(null)).thenThrow(new CourseRouteException(INVALID_REQUEST));
        when(service.getCatalog("unknown")).thenThrow(new CourseRouteException(INVALID_REQUEST));
        mvc.perform(get("/v1/courses/0/route")).andExpect(status().isBadRequest());
        mvc.perform(get("/v1/courses/-1/route")).andExpect(status().isBadRequest());
        mvc.perform(get("/v1/courses/99/route")).andExpect(status().isNotFound());
        mvc.perform(get("/v1/courses/nope/route")).andExpect(status().isBadRequest());
        mvc.perform(get("/v1/course-routes")).andExpect(status().isBadRequest());
        mvc.perform(get("/v1/course-routes").param("mountainKey", "unknown")).andExpect(status().isBadRequest());
        mvc.perform(post("/v1/course-routes")).andExpect(status().isMethodNotAllowed());
    }
}
