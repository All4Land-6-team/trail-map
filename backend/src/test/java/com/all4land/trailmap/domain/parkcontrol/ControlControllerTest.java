package com.all4land.trailmap.domain.parkcontrol;

import com.all4land.trailmap.domain.parkcontrol.controller.ControlController;
import com.all4land.trailmap.domain.parkcontrol.service.ControlQueryService;
import com.all4land.trailmap.domain.parkcontrol.dto.response.ControlResponse;
import com.all4land.trailmap.domain.courseroute.exception.CourseRouteException;
import static com.all4land.trailmap.domain.courseroute.error.CourseRouteErrorCode.NOT_FOUND;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ControlController.class)
class ControlControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean ControlQueryService service;
    @Test void publicReadUsesEnvelopeAndDoesNotCache() throws Exception {
        when(service.get(1)).thenReturn(new ControlResponse(1, "bukhansan", "OFFICE_REGION", "MISSING", null));
        mvc.perform(get("/v1/courses/1/access-control")).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.data.availability").value("MISSING"));
        when(service.get(99)).thenThrow(new CourseRouteException(NOT_FOUND));
        mvc.perform(get("/v1/courses/99/access-control")).andExpect(status().isNotFound());
    }
}
