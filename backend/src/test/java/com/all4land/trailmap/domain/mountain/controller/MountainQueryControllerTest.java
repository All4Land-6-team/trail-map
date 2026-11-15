package com.all4land.trailmap.domain.mountain.controller;

import com.all4land.trailmap.domain.mountain.dto.response.MountainResponse;
import com.all4land.trailmap.domain.mountain.service.MountainQueryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MountainQueryController.class)
class MountainQueryControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    MountainQueryService service;

    @Test
    void 공용_산_목록을_조회한다() throws Exception {
        given(service.getMountains()).willReturn(List.of(
                new MountainResponse(3L, "bukhansan", "북한산", 126.98, 37.66)
        ));

        mockMvc.perform(get("/v1/mountains").header("X-User-Id", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].mountainId").value(3))
                .andExpect(jsonPath("$.data[0].externalId").value("bukhansan"));
        mockMvc.perform(get("/v1/mountains"))
                .andExpect(status().isUnauthorized());
    }
}
