package com.all4land.trailmap.domain.hike.controller;

import com.all4land.trailmap.domain.hike.dto.response.HikeScheduleResponse;
import com.all4land.trailmap.domain.hike.error.HikeErrorCode;
import com.all4land.trailmap.domain.hike.exception.HikeException;
import com.all4land.trailmap.domain.hike.service.HikeScheduleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HikeScheduleController.class)
class HikeScheduleControllerTest {

    private static final HikeScheduleResponse RESPONSE = new HikeScheduleResponse(
            1L, LocalDate.of(2026, 11, 1), LocalTime.of(7, 30),
            10L, "백운대 코스", 3L, "북한산", 4200.0, 10800
    );

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    HikeScheduleService hikeScheduleService;

    @Test
    void 일정을_등록하면_201과_화면용_일정_정보를_반환한다() throws Exception {
        given(hikeScheduleService.create(eq(7L), any())).willReturn(RESPONSE);

        mockMvc.perform(post("/v1/hike-schedules")
                        .header("X-User-Id", "7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"courseId": 10, "date": "2026-11-01", "startTime": "07:30"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.httpStatus").value(201))
                .andExpect(jsonPath("$.data.scheduleId").value(1))
                .andExpect(jsonPath("$.data.date").value("2026-11-01"))
                .andExpect(jsonPath("$.data.startTime").value("07:30"))
                .andExpect(jsonPath("$.data.mountainName").value("북한산"));
    }

    @Test
    void X_User_Id_헤더가_없거나_올바르지_않으면_401을_반환한다() throws Exception {
        mockMvc.perform(get("/v1/hike-schedules").param("from", "2026-11-01").param("to", "2026-11-30"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("GLOBAL_401"));

        mockMvc.perform(get("/v1/hike-schedules/1").header("X-User-Id", "abc"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/v1/hike-schedules/1").header("X-User-Id", "0"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(hikeScheduleService);
    }

    @Test
    void 필수값이_없거나_시각_형식이_틀리면_400을_반환한다() throws Exception {
        mockMvc.perform(post("/v1/hike-schedules")
                        .header("X-User-Id", "7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date": "2026-11-01", "startTime": "07:30"}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/v1/hike-schedules")
                        .header("X-User-Id", "7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"courseId": 10, "date": "2026-11-01", "startTime": "7시 30분"}
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(hikeScheduleService);
    }

    @Test
    void 같은_날짜_일정_충돌은_409로_반환한다() throws Exception {
        given(hikeScheduleService.create(eq(7L), any()))
                .willThrow(new HikeException(HikeErrorCode.SCHEDULE_ALREADY_EXISTS));

        mockMvc.perform(post("/v1/hike-schedules")
                        .header("X-User-Id", "7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"courseId": 10, "date": "2026-11-01", "startTime": "07:30"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("HIKE_409_1"));
    }

    @Test
    void 기간으로_일정_목록을_조회한다() throws Exception {
        given(hikeScheduleService.getSchedules(7L, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30)))
                .willReturn(List.of(RESPONSE));

        mockMvc.perform(get("/v1/hike-schedules")
                        .header("X-User-Id", "7")
                        .param("from", "2026-11-01")
                        .param("to", "2026-11-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].courseName").value("백운대 코스"));
    }
}
