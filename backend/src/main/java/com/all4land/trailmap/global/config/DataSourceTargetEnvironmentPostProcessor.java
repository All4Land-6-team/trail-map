package com.all4land.trailmap.global.config;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.apache.commons.logging.Log;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.boot.logging.DeferredLogFactory;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.PropertySource;
import org.springframework.core.env.StandardEnvironment;

/**
 * 개발 서버가 어느 DB에 연결되는지 시작 시점에 확인하고 로그로 남긴다.
 *
 * <p>localdb·supabase profile을 지정하면 실제 연결 주소가 해당 대상과 맞는지 검증하고,
 * 이전 셸에 남은 SPRING_DATASOURCE_* 환경 변수가 profile 설정을 덮어쓰지 못하게 막는다.
 * 비밀번호와 사용자 이름은 로그에 남기지 않는다. Flyway·DataSource보다 먼저 실행되므로
 * Flyway를 끈 실행에서도 연결 대상이 표시된다.
 */
public class DataSourceTargetEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    static final String LOCAL_DB = "localdb";
    static final String SUPABASE = "supabase";
    static final List<String> OVERRIDE_ENV_KEYS =
            List.of("SPRING_DATASOURCE_URL", "SPRING_DATASOURCE_USERNAME", "SPRING_DATASOURCE_PASSWORD");
    private static final Set<String> LOCAL_HOSTS = Set.of("localhost", "127.0.0.1", "[::1]", "::1");

    private final Log log;

    public DataSourceTargetEnvironmentPostProcessor(DeferredLogFactory logFactory) {
        this.log = logFactory.getLog(DataSourceTargetEnvironmentPostProcessor.class);
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        log.info(describe(environment));
    }

    /** 검증을 통과하면 로그 문구를 반환하고, 대상이 어긋나면 시작을 중단한다. */
    static String describe(ConfigurableEnvironment environment) {
        List<String> targets = Arrays.stream(environment.getActiveProfiles())
                .filter(p -> p.equals(LOCAL_DB) || p.equals(SUPABASE))
                .distinct()
                .toList();
        if (targets.size() > 1) {
            throw new IllegalStateException("DB 대상 profile은 하나만 지정해야 합니다: " + String.join(", ", targets));
        }
        String url = environment.getProperty("spring.datasource.url");
        Endpoint endpoint = Endpoint.parse(url);

        if (targets.isEmpty()) {
            return "DB 연결 대상: 기본 설정(DB profile 미지정) " + endpoint
                    + " — 명시하려면 bootRun -Pdb=localdb 또는 -Pdb=supabase로 실행";
        }

        String target = targets.get(0);
        List<String> overrides = overrideEnvKeys(environment);
        if (!overrides.isEmpty()) {
            throw new IllegalStateException("DB 대상 " + target + " profile 설정을 환경 변수 "
                    + String.join(", ", overrides) + "가 덮어씁니다. 해당 환경 변수를 제거한 셸에서 다시 실행하세요.");
        }
        if (target.equals(LOCAL_DB) && !endpoint.local()) {
            throw new IllegalStateException("localdb profile인데 로컬이 아닌 DB에 연결하려 합니다: " + endpoint);
        }
        if (target.equals(SUPABASE) && (endpoint.host() == null || endpoint.local())) {
            throw new IllegalStateException("supabase profile인데 Supabase 접속 주소가 없습니다: " + endpoint
                    + ". application-supabase-secret.properties의 spring.datasource.url을 확인하세요.");
        }
        return "DB 연결 대상: " + target + " " + endpoint;
    }

    private static List<String> overrideEnvKeys(ConfigurableEnvironment environment) {
        PropertySource<?> systemEnv = environment.getPropertySources()
                .get(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        if (systemEnv == null) {
            return List.of();
        }
        return OVERRIDE_ENV_KEYS.stream().filter(systemEnv::containsProperty).toList();
    }

    @Override
    public int getOrder() {
        // profile·config import가 모두 반영된 뒤 확인한다.
        return Ordered.LOWEST_PRECEDENCE;
    }

    /** 비밀값 없이 표시할 JDBC 접속 위치. */
    record Endpoint(String scheme, String host, int port, String database) {

        static Endpoint parse(String jdbcUrl) {
            if (jdbcUrl == null || !jdbcUrl.startsWith("jdbc:")) {
                return new Endpoint("unknown", null, -1, null);
            }
            String rest = jdbcUrl.substring("jdbc:".length());
            int colon = rest.indexOf(':');
            String scheme = colon < 0 ? rest : rest.substring(0, colon);
            if (!rest.contains("://")) {
                return new Endpoint(scheme, null, -1, null);
            }
            try {
                URI uri = URI.create(rest);
                String path = uri.getPath();
                String database = path == null || path.length() <= 1 ? null : path.substring(1);
                return new Endpoint(scheme, uri.getHost(), uri.getPort(), database);
            } catch (IllegalArgumentException e) {
                return new Endpoint(scheme, null, -1, null);
            }
        }

        boolean local() {
            return host != null && LOCAL_HOSTS.contains(host.toLowerCase(Locale.ROOT));
        }

        @Override
        public String toString() {
            if (host == null) {
                return "(" + scheme + ")";
            }
            return "(" + scheme + " " + host + (port > 0 ? ":" + port : "") + (database == null ? "" : "/" + database) + ")";
        }
    }
}
