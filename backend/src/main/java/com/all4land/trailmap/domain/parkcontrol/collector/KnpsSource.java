package com.all4land.trailmap.domain.parkcontrol.collector;

import com.all4land.trailmap.domain.parkcontrol.entity.ControlAsset;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Pattern;

@Component
public class KnpsSource {
    static final String LIST = "https://www.knps.or.kr/front/portal/safe/acsCtrList.do?menuNo=8000340";
    static final Map<String,String> OFFICES = Map.of("0019", "북한산", "0020", "북한산도봉");
    public record Office(String id, String status, Instant asOf, String url) {}
    public record Detail(String reason, String text, String section, String period, String contact,
                         Instant asOf, List<ControlAsset> assets) {}

    Document fetch(String url) throws IOException {
        return Jsoup.connect(trusted(url)).followRedirects(false).timeout(15000).maxBodySize(2_000_000).get();
    }

    static String trusted(String url) {
        URI u = URI.create(url);
        if (!"https".equals(u.getScheme()) || !"www.knps.or.kr".equalsIgnoreCase(u.getHost())
                || u.getRawUserInfo() != null || (u.getPort() != -1 && u.getPort() != 443))
            throw new IllegalArgumentException("공단 HTTPS 주소가 아닙니다");
        return url;
    }

    static Map<String,Office> offices(Document doc) {
        Map<String,Office> result = new LinkedHashMap<>();
        for (Element row : doc.select("tr[data-href]")) {
            var cells = row.children();
            if (cells.size() != 4 || !"북한산".equals(cells.get(0).text())) continue;
            String url = trusted(row.absUrl("data-href"));
            var idMatch = Pattern.compile("(?:^|&)rstId=([0-9]+)(?:&|$)").matcher(
                    Objects.toString(URI.create(url).getRawQuery(), ""));
            if (!idMatch.find()) throw new IllegalArgumentException("사무소 식별자 누락");
            String id = idMatch.group(1);
            if (!cells.get(1).text().equals(OFFICES.get(id))) throw new IllegalArgumentException("사무소 불일치");
            Office item = new Office(id, status(cells.get(2).text()), time(cells.get(3).text()), url);
            if (result.put(id, item) != null) throw new IllegalArgumentException("중복 사무소");
        }
        if (!result.keySet().equals(OFFICES.keySet())) throw new IllegalArgumentException("북한산 목록 누락");
        return result;
    }

    static Detail detail(Document doc, Office office) {
        Element body = Objects.requireNonNull(doc.selectFirst(".box_flagship1 td.cont"), "본문 누락");
        Element table = body.closest("table");
        Map<String,Element> fields = new HashMap<>();
        for (Element th : table.select("th")) {
            Element td = th.nextElementSibling();
            if (td != null && td.tagName().equals("td")) fields.put(th.text(), td);
        }
        Instant asOf = time(fields.get("기준시간").text());
        if (!fields.get("공원(사무소)").text().equals("북한산(" + OFFICES.get(office.id()) + ")")
                || !status(fields.get("상황").text()).equals(office.status())
                || !asOf.truncatedTo(ChronoUnit.MINUTES).equals(office.asOf().truncatedTo(ChronoUnit.MINUTES)))
            throw new IllegalArgumentException("목록과 상세 불일치");
        Element copy = body.clone();
        copy.select("p,div,br,li").forEach(e -> e.before(new org.jsoup.nodes.TextNode("\n")));
        // \ud654\uba74\uc774 pre-wrap\uc73c\ub85c \uadf8\ub9ac\ubbc0\ub85c \uacf5\ub2e8 HTML\uc758 \ub4e4\uc5ec\uc4f0\uae30\uc640 \uc5f0\uc18d \ube48 \uc904\uc744 \uc815\ub9ac\ud55c\ub2e4.
        String text = String.join("\n", copy.wholeText().replace('\u00a0',' ').lines().map(String::strip).toList())
                .replaceAll("\n{3,}", "\n\n").strip();
        if (text.isBlank()) throw new IllegalArgumentException("빈 통제 본문");
        List<ControlAsset> assets = new ArrayList<>();
        for (var img : body.select("img[src]"))
            assets.add(new ControlAsset("INLINE","통제구간 안내",trusted(img.absUrl("src")),null,null));
        Element files = fields.get("첨부파일");
        if (files != null) for (var a : files.select("a[href]"))
            assets.add(new ControlAsset("ATTACHMENT",a.text(),trusted(a.absUrl("href")),null,null));
        return new Detail(fields.get("통제사유").text(), text, field(text,"통제구간"),
                field(text,"통제일자|통제기간"), field(text,"문의전화|문의처"), asOf, assets);
    }

    private static String field(String text, String label) {
        var m = Pattern.compile("(?m)^\\h*(?:\\d+[.)]\\h*)?(?:" + label + ")\\h*[:：]\\h*(.+)$").matcher(text);
        return m.find() ? m.group(1).strip() : null;
    }

    private static Instant time(String value) {
        return LocalDateTime.parse(value, DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm[:ss]"))
                .atZone(ZoneId.of("Asia/Seoul")).toInstant();
    }

    private static String status(String value) {
        return switch (value) {
            case "정상" -> "NORMAL";
            case "부분통제" -> "PARTIAL";
            case "전면통제", "전면 통제" -> "CLOSED";
            default -> throw new IllegalArgumentException("미지원 통제 상태: " + value);
        };
    }
}
