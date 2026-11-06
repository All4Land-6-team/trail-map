package com.all4land.trailmap.domain.parkcontrol.collector;

import com.all4land.trailmap.domain.parkcontrol.repository.ControlImportRepository;
import com.all4land.trailmap.global.config.r2.R2Properties;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.web.servlet.ServletWebServerFactoryAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.web.servlet.context.AnnotationConfigServletWebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.embedded.*;
import software.amazon.awssdk.services.s3.S3Client;

import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ControlCollectorTest {
    private EmbeddedDatabase database;
    private JdbcTemplate db;
    private ControlImportRepository repo;

    @BeforeEach void init() {
        database = new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2).build();
        db = new JdbcTemplate(database);
        db.execute("CREATE DOMAIN IF NOT EXISTS TIMESTAMPTZ AS TIMESTAMP WITH TIME ZONE");
        var schema = new org.springframework.jdbc.datasource.init.ResourceDatabasePopulator(
                new org.springframework.core.io.ClassPathResource("db/migration/V11__add_park_access_control.sql"));
        schema.setSqlScriptEncoding("UTF-8");
        schema.execute(database);
        repo = new ControlImportRepository(db);
    }
    @AfterEach void close() { database.shutdown(); }

    @Test void onlyFetchesControlledOfficeAndClearsItOnReopening() throws Exception {
        var source = mock(KnpsSource.class);
        var images = mock(ControlAssetImporter.class);
        var collector = new ControlCollector(source, images, repo);
        String url = "https://www.knps.or.kr/detail?rstId=0019";
        String list = """
            <table><tr data-href='/detail?rstId=0019'><td>북한산<td>북한산<td>부분통제<td>2026-10-18 23:06
            <tr data-href='/detail?rstId=0020'><td>북한산<td>북한산도봉<td>정상<td>2026-10-19 04:00</table>
            """;
        String detail = """
            <div class=box_flagship1><table><tr><th>공원(사무소)<td>북한산(북한산)<th>상황<td>부분통제
            <tr><th>통제사유<td>산사태 발생<th>기준시간<td>2026-10-18 23:06:00
            <tr><th>첨부파일<td><a href='/file'>지도.jpg</a>
            <tr><td class=cont><p>안내</p><p>&nbsp;</p><p>&nbsp;</p><p>    ※ 데크 파손</p><p>4. 통제구간: 구천계곡</p><img src='/map'></table></div>
            """;
        when(source.fetch(KnpsSource.LIST)).thenReturn(Jsoup.parse(list, KnpsSource.LIST));
        when(source.fetch(url)).thenReturn(Jsoup.parse(detail, url));
        collector.collect();
        collector.collect();
        assertEquals(2, count("park_access_control_asset"));
        assertEquals("구천계곡", value("restricted_section"));
        assertEquals("안내\n\n※ 데크 파손\n4. 통제구간: 구천계곡", value("content_text"));
        var checkedAt = value("checked_at");
        when(source.fetch(url)).thenReturn(Jsoup.parse(detail.replace("23:06:00", "23:07:00"), url));
        assertThrows(java.io.IOException.class, collector::collect);
        assertEquals("ERROR", value("collection_state"));
        assertEquals(checkedAt, value("checked_at"));
        assertEquals("구천계곡", value("restricted_section"));
        assertEquals(1, count("park_access_control WHERE source_record_id='0020' AND status='NORMAL' AND collection_state='READY'"));
        when(source.fetch(KnpsSource.LIST)).thenReturn(Jsoup.parse("<table/>"));
        assertThrows(java.io.IOException.class, collector::collect);
        assertEquals("PARTIAL", value("status"));
        assertEquals("ERROR", value("collection_state"));
        when(source.fetch(KnpsSource.LIST)).thenReturn(Jsoup.parse(list.replace("부분통제","정상"), KnpsSource.LIST));
        collector.collect();
        assertEquals("NORMAL", value("status"));
        assertNull(value("content_text"));
        assertEquals(0, count("park_access_control_asset"));
        verify(source, times(3)).fetch(url);
        verify(source, never()).fetch(url.replace("0019","0020"));
    }

    @Test void importerStartsInWebServerContext() {
        // 내장 Tomcat 컨텍스트에서는 상대 경로 문자열이 서블릿 리소스로 해석돼 Path 변환이 실패할 수 있다.
        new ApplicationContextRunner(AnnotationConfigServletWebServerApplicationContext::new)
                .withConfiguration(AutoConfigurations.of(ServletWebServerFactoryAutoConfiguration.class))
                .withPropertyValues("server.port=0")
                .withBean(S3Client.class, () -> mock(S3Client.class))
                .withBean(R2Properties.class, () -> new R2Properties("b", null, null, null, null, null))
                .withUserConfiguration(ControlAssetImporter.class)
                .run(context -> assertNull(context.getStartupFailure()));
    }

    @Test @EnabledIfEnvironmentVariable(named="KNPS_LIVE_TEST", matches="true")
    void importsLiveOfficesTwice(@TempDir Path images) throws Exception {
        var collector = new ControlCollector(new KnpsSource(), new ControlAssetImporter(null,null,images.toString(),false),repo);
        collector.collect();
        int assets = count("park_access_control_asset");
        collector.collect();
        assertEquals(2, count("park_access_control WHERE collection_state='READY' AND checked_at IS NOT NULL"));
        assertEquals(assets, count("park_access_control_asset"));
        System.out.printf("KNPS live rows=%s%nassets=%s%n", db.queryForList("""
                SELECT source_record_id,status,reason,restricted_section,restriction_period_text,contact,source_as_of,content_text
                FROM park_access_control ORDER BY source_record_id"""),
                db.queryForList("SELECT control_id,asset_order,kind,name,media_type FROM park_access_control_asset"));
    }

    private String value(String column) {
        return db.queryForObject("SELECT " + column + " FROM park_access_control WHERE source_record_id='0019'", String.class);
    }
    private int count(String table) { return db.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class); }
}
