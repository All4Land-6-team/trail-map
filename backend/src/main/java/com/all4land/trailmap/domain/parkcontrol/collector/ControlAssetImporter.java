package com.all4land.trailmap.domain.parkcontrol.collector;

import com.all4land.trailmap.domain.parkcontrol.entity.ControlAsset;
import com.all4land.trailmap.global.config.r2.R2Properties;
import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;

import javax.imageio.ImageIO;
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;

@Component
public class ControlAssetImporter {
    private static final int MAX_BYTES = 12 * 1024 * 1024;
    private final S3Client s3;
    private final R2Properties r2;
    private final Path cache;
    private final boolean upload;

    public ControlAssetImporter(S3Client s3, R2Properties r2,
            @Value("${park-control.import.image-dir:../data/raw/knps/control}") String cache,
            @Value("${park-control.import.upload:false}") boolean upload) {
        this.s3 = s3;
        this.r2 = r2;
        // Path로 바로 주입하면 웹 서버 컨텍스트가 서블릿 리소스로 해석해 기동이 실패한다.
        this.cache = Path.of(cache);
        this.upload = upload;
    }

    void store(String office, ControlAsset asset) throws Exception {
        var response = Jsoup.connect(KnpsSource.trusted(asset.getSourceUrl())).followRedirects(false)
                .ignoreContentType(true).timeout(15000).maxBodySize(MAX_BYTES + 1).execute();
        if (response.statusCode() != 200) throw new IOException("이미지 요청 실패");
        storeResponse(office, asset, response.bodyAsBytes(), response.contentType());
    }

    void storeResponse(String office, ControlAsset asset, byte[] bytes, String contentType) throws Exception {
        if (bytes.length == 0) throw new IOException("빈 첨부 응답");
        String format;
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                if (isDocumentLink(asset, contentType)) return;
                throw new IOException("이미지 형식 미확인");
            }
            if (bytes.length > MAX_BYTES) throw new IOException("이미지 용량 초과");
            var reader = readers.next();
            try {
                reader.setInput(input);
                format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!java.util.Set.of("jpeg","png","gif").contains(format)
                        || (long) reader.getWidth(0) * reader.getHeight(0) > 40_000_000)
                    throw new IOException("지원하지 않는 이미지");
                reader.read(0);
            } finally { reader.dispose(); }
        }
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        String key = "park-control/" + office + "/" + hash + "." + format;
        String type = "image/" + format;
        if (upload) {
            s3.putObject(b -> b.bucket(r2.bucketName()).key(key).contentType(type), RequestBody.fromBytes(bytes));
            asset.setObjectKey(key);
        } else {
            Path file = cache.resolve(key);
            Files.createDirectories(file.getParent());
            Files.write(file, bytes);
        }
        asset.setMediaType(type);
    }

    // 문서는 원본 링크로 제공한다. 공단 오류 페이지와 손상된 이미지는 성공으로 취급하지 않는다.
    private static boolean isDocumentLink(ControlAsset asset, String contentType) {
        if (!"ATTACHMENT".equals(asset.getKind())) return false;
        String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT).split(";", 2)[0].strip();
        if (type.startsWith("image/") || type.equals("text/html") || type.equals("application/xhtml+xml")) return false;
        String name = asset.getName().toLowerCase(Locale.ROOT);
        int dot = name.lastIndexOf('.');
        String extension = dot < 0 ? "" : name.substring(dot + 1);
        if (Set.of("jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tif", "tiff", "avif", "heic", "ico").contains(extension)) return false;
        // 판독 가능한 이미지는 이 분기 전에 처리했다. MIME을 생략한 첨부는 파일명으로 보완한다.
        return !extension.isEmpty() || (!type.isEmpty() && !type.equals("application/octet-stream"));
    }
}
