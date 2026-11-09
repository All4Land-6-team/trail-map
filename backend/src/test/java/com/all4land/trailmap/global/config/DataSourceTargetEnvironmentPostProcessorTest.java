package com.all4land.trailmap.global.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.env.SystemEnvironmentPropertySource;

class DataSourceTargetEnvironmentPostProcessorTest {

    private static final String SUPABASE_URL =
            "jdbc:postgresql://aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require";

    @Test
    void localdb_profile은_로컬_주소를_표시하고_비밀값은_남기지_않는다() {
        StandardEnvironment env = environment(Map.of(), Map.of(
                "spring.datasource.url", "jdbc:postgresql://localhost:5432/trail_map",
                "spring.datasource.username", "postgres",
                "spring.datasource.password", "local-secret"), "localdb");

        String message = DataSourceTargetEnvironmentPostProcessor.describe(env);

        assertThat(message).isEqualTo("DB 연결 대상: localdb (postgresql localhost:5432/trail_map)");
        assertThat(message).doesNotContain("local-secret").doesNotContain("postgres)");
    }

    @Test
    void supabase_profile은_원격_주소를_표시한다() {
        StandardEnvironment env = environment(Map.of(), Map.of(
                "spring.datasource.url", SUPABASE_URL,
                "spring.datasource.username", "postgres.projectref",
                "spring.datasource.password", "remote-secret"), "supabase");

        String message = DataSourceTargetEnvironmentPostProcessor.describe(env);

        assertThat(message)
                .isEqualTo("DB 연결 대상: supabase (postgresql aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres)")
                .doesNotContain("remote-secret")
                .doesNotContain("projectref")
                .doesNotContain("sslmode");
    }

    @Test
    void profile이_없으면_기본_설정으로_표시한다() {
        StandardEnvironment env = environment(Map.of(),
                Map.of("spring.datasource.url", "jdbc:h2:mem:trail_map;MODE=PostgreSQL"));

        assertThat(DataSourceTargetEnvironmentPostProcessor.describe(env))
                .startsWith("DB 연결 대상: 기본 설정(DB profile 미지정) (h2)");
    }

    @Test
    void 이전_셸의_datasource_환경_변수가_있으면_profile_실행을_중단한다() {
        StandardEnvironment env = environment(
                Map.of("SPRING_DATASOURCE_URL", "jdbc:postgresql://localhost:5432/trail_map",
                        "SPRING_DATASOURCE_PASSWORD", "leftover"),
                Map.of("spring.datasource.url", SUPABASE_URL), "supabase");

        assertThatThrownBy(() -> DataSourceTargetEnvironmentPostProcessor.describe(env))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SPRING_DATASOURCE_URL, SPRING_DATASOURCE_PASSWORD")
                .hasMessageNotContaining("leftover");
    }

    @Test
    void localdb_profile인데_원격_주소면_중단한다() {
        StandardEnvironment env = environment(Map.of(), Map.of("spring.datasource.url", SUPABASE_URL), "localdb");

        assertThatThrownBy(() -> DataSourceTargetEnvironmentPostProcessor.describe(env))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("localdb profile인데 로컬이 아닌 DB");
    }

    @Test
    void supabase_profile인데_로컬_주소면_중단한다() {
        StandardEnvironment env = environment(Map.of(),
                Map.of("spring.datasource.url", "jdbc:postgresql://localhost:5432/trail_map"), "supabase");

        assertThatThrownBy(() -> DataSourceTargetEnvironmentPostProcessor.describe(env))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("application-supabase-secret.properties");
    }

    @Test
    void DB_대상_profile을_동시에_지정하면_중단한다() {
        StandardEnvironment env = environment(Map.of(), Map.of("spring.datasource.url", SUPABASE_URL),
                "localdb", "supabase");

        assertThatThrownBy(() -> DataSourceTargetEnvironmentPostProcessor.describe(env))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("하나만");
    }

    private static StandardEnvironment environment(Map<String, Object> systemEnv, Map<String, Object> properties,
            String... profiles) {
        StandardEnvironment env = new StandardEnvironment();
        env.getPropertySources().replace(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                new SystemEnvironmentPropertySource(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                        new HashMap<>(systemEnv)));
        env.getPropertySources().addFirst(new MapPropertySource("test", new HashMap<>(properties)));
        env.setActiveProfiles(profiles);
        return env;
    }
}
