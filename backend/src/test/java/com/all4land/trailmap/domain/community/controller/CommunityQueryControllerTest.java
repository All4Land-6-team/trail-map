package com.all4land.trailmap.domain.community.controller;

import com.all4land.trailmap.domain.community.dto.response.CommunitySpotResponse;
import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import com.all4land.trailmap.domain.community.entity.CommunitySpotType;
import com.all4land.trailmap.domain.community.entity.CommunityVoteType;
import com.all4land.trailmap.domain.community.service.CommunityQueryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CommunityQueryController.class)
class CommunityQueryControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    CommunityQueryService queryService;

    @Test
    void 지도_스팟_조회_파라미터와_사용자를_서비스에_전달한다() throws Exception {
        given(queryService.getSpots(eq(7L), eq(3L), any())).willReturn(List.of(
                new CommunitySpotResponse(
                        CommunitySpotTargetType.FACILITY, 10L, 3L, "백운탐방지원센터 화장실",
                        CommunitySpotType.RESTROOM, 126.981, 37.661, true, "AVAILABLE",
                        2, 1, CommunityVoteType.YES, 4, 3, "facility/10/photo.webp"
                )
        ));

        mockMvc.perform(get("/v1/community/mountains/3/spots")
                        .header("X-User-Id", "7")
                        .param("west", "126.9")
                        .param("south", "37.5")
                        .param("east", "127.1")
                        .param("north", "37.8")
                        .param("type", "RESTROOM"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].targetType").value("FACILITY"))
                .andExpect(jsonPath("$.data[0].type").value("RESTROOM"))
                .andExpect(jsonPath("$.data[0].viewerVote").value("YES"));
    }

    @Test
    void 지도_영역이_빠졌거나_뒤집히면_400을_반환한다() throws Exception {
        mockMvc.perform(get("/v1/community/mountains/3/spots")
                        .header("X-User-Id", "7")
                        .param("west", "126.9")
                        .param("south", "37.5")
                        .param("east", "127.1"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/v1/community/mountains/3/spots")
                        .header("X-User-Id", "7")
                        .param("west", "127.1")
                        .param("south", "37.8")
                        .param("east", "126.9")
                        .param("north", "37.5"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(queryService);
    }

    @Test
    void 사용자_헤더가_없거나_대상_ID가_양수가_아니면_오류를_반환한다() throws Exception {
        mockMvc.perform(get("/v1/community/mountains/3/reviews"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/v1/community/mountains/0/reviews")
                        .header("X-User-Id", "7"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GLOBAL_400_3"));

        verifyNoInteractions(queryService);
    }
}
