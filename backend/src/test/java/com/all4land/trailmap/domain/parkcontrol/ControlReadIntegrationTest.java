package com.all4land.trailmap.domain.parkcontrol;

import com.all4land.trailmap.domain.parkcontrol.entity.*;
import com.all4land.trailmap.domain.parkcontrol.repository.*;
import com.all4land.trailmap.domain.parkcontrol.service.ControlQueryService;
import com.all4land.trailmap.domain.parkcontrol.storage.ControlImageStorage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@ContextConfiguration(classes = ControlReadIntegrationTest.Config.class)
class ControlReadIntegrationTest {
    @TestConfiguration
    @EntityScan(basePackageClasses = ParkAccessControl.class)
    @EnableJpaRepositories(basePackageClasses = ParkControlRepository.class)
    @Import({ControlQueryService.class, ControlCourseRepository.class})
    static class Config {}
    @Autowired ParkControlRepository controls;
    @Autowired ControlQueryService service;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ControlImageStorage images;
    @Test void readsPersistedOfficeAssetsAndCourseMapping() {
        jdbc.execute("CREATE TABLE course (course_id BIGINT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE course_route_metadata (course_id BIGINT PRIMARY KEY, mountain_key VARCHAR(30))");
        jdbc.update("INSERT INTO course VALUES (1), (2), (3)");
        jdbc.update("INSERT INTO course_route_metadata VALUES (1, 'bukhansan'), (2, 'dobongsan')");
        var r = new ParkAccessControl(); r.setSourceRecordId("0019"); r.setMountainKey("bukhansan");
        r.setOfficeName("북한산사무소"); r.setSourceUrl("https://www.knps.or.kr/example");
        r.setStatus("PARTIAL"); r.setCollectionState("READY"); r.setCheckedAt(Instant.now());
        r.setReason("산사태"); r.setContentText("본문\n문의처");
        r.getAssets().add(new ControlAsset("INLINE", "지도", "https://www.knps.or.kr/image", "saved.png", "image/png"));
        controls.saveAndFlush(r);
        when(images.readUrl("saved.png")).thenReturn("https://example.com/saved.png");
        var response = service.get(1);
        assertThat(response.office().status()).isEqualTo("PARTIAL");
        assertThat(response.office().assets().getFirst().imageUrl()).isEqualTo("https://example.com/saved.png");
        assertThat(service.get(2).availability()).isEqualTo("MISSING");
        assertThat(service.get(3).availability()).isEqualTo("UNSUPPORTED");
    }
}
