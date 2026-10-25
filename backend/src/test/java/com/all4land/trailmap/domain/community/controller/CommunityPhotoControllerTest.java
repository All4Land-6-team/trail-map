package com.all4land.trailmap.domain.community.controller;

import com.all4land.trailmap.domain.community.dto.response.CommunityPhotoUploadUrlResponse;
import com.all4land.trailmap.domain.community.service.CommunityPhotoService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CommunityPhotoController.class)
class CommunityPhotoControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    CommunityPhotoService photoService;

    @Test
    void 사진_업로드_URL_요청을_사용자와_함께_서비스에_전달한다() throws Exception {
        given(photoService.requestUploadUrl(eq(7L), any())).willReturn(new CommunityPhotoUploadUrlResponse(
                "community/mountain/3/11/photo.jpg",
                "https://upload.test",
                OffsetDateTime.parse("2026-10-25T10:10:00+09:00")
        ));

        mockMvc.perform(post("/v1/community/photos/upload-url")
                        .header("X-User-Id", "7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.uploadUrl").value("https://upload.test"));
    }

    @Test
    void 지원하지_않는_MIME과_5MB_초과_파일은_거절한다() throws Exception {
        mockMvc.perform(post("/v1/community/photos/upload-url")
                        .header("X-User-Id", "7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "targetType": "MOUNTAIN_REVIEW",
                                  "targetId": 11,
                                  "originalFileName": "북한산.gif",
                                  "mediaType": "image/gif",
                                  "fileSizeBytes": 5242881,
                                  "displayOrder": 0
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(photoService);
    }

    private static String validRequest() {
        return """
                {
                  "targetType": "MOUNTAIN_REVIEW",
                  "targetId": 11,
                  "originalFileName": "북한산.jpg",
                  "mediaType": "image/jpeg",
                  "fileSizeBytes": 1024,
                  "displayOrder": 0
                }
                """;
    }
}
