package com.all4land.trailmap.domain.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class UserProfileApiIntegrationTest {

    private static final DockerImageName POSTGIS_IMAGE = DockerImageName
            .parse("pgrouting/pgrouting:16-3.5-3.8")
            .asCompatibleSubstituteFor("postgres");

    @Container
    @ServiceConnection
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("trail_map")
            .withUsername("postgres")
            .withPassword("postgres");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbcTemplate;

    long userId;

    @BeforeEach
    void setUp() {
        userId = jdbcTemplate.queryForObject(
                "INSERT INTO app_user (nickname) VALUES (NULL) RETURNING user_id",
                Long.class
        );
    }

    @Test
    void 닉네임을_조회하고_변경하며_빈_값은_익명으로_되돌린다() throws Exception {
        mockMvc.perform(asUser(userId, get("/v1/users/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nickname").value("익명"));

        mockMvc.perform(asUser(userId, patch("/v1/users/me"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nickname":" 산다람쥐 "}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(userId))
                .andExpect(jsonPath("$.data.nickname").value("산다람쥐"));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT nickname FROM app_user WHERE user_id = ?", String.class, userId
        )).isEqualTo("산다람쥐");

        mockMvc.perform(asUser(userId, patch("/v1/users/me"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nickname":"   "}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nickname").value("익명"));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT nickname IS NULL FROM app_user WHERE user_id = ?", Boolean.class, userId
        )).isTrue();
    }

    @Test
    void 닉네임은_최대_12자이며_없는_사용자는_조회할_수_없다() throws Exception {
        mockMvc.perform(asUser(userId, patch("/v1/users/me"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nickname":"가나다라마바사아자차카타파"}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(asUser(Long.MAX_VALUE, get("/v1/users/me")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("USER_404_1"));
    }

    private static MockHttpServletRequestBuilder asUser(long userId, MockHttpServletRequestBuilder request) {
        return request.header("X-User-Id", userId);
    }
}
