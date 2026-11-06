package com.all4land.trailmap.domain.parkcontrol.collector;

import com.all4land.trailmap.domain.parkcontrol.entity.ControlAsset;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.*;

class ControlAssetImporterTest {
    @TempDir Path cache;

    @Test void savesDecodedFormatAndKeepsDocumentsAsSourceLinks() throws Exception {
        var importer = new ControlAssetImporter(null, null, cache.toString(), false);
        var image = attachment("map.jpg");
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", bytes);
        importer.storeResponse("0019", image, bytes.toByteArray(), "image/jpeg");
        assertThat(image.getMediaType()).isEqualTo("image/png");
        try (var files = Files.list(cache.resolve("park-control/0019"))) {
            var file = files.findFirst().orElseThrow();
            assertThat(file.getFileName().toString()).endsWith(".png");
            assertThat(Files.readAllBytes(file)).isEqualTo(bytes.toByteArray());
        }

        var document = attachment("notice.pdf");
        importer.storeResponse("0019", document, "%PDF-1.7".getBytes(StandardCharsets.US_ASCII), "application/octet-stream");
        assertThat(document.getObjectKey()).isNull();
        assertThat(document.getMediaType()).isNull();
        var gpx = "<gpx/>".getBytes(StandardCharsets.US_ASCII);
        importer.storeResponse("0019", attachment("route.gpx"), gpx, "application/gpx+xml");
        importer.storeResponse("0019", attachment("route.gpx"), gpx, "application/octet-stream");
        importer.storeResponse("0019", attachment("route"), gpx, "application/gpx+xml");
        assertThatThrownBy(() -> importer.storeResponse("0019", attachment("route.gpx"), gpx, "image/png"))
                .isInstanceOf(IOException.class);
        assertThatThrownBy(() -> importer.storeResponse("0019", attachment("broken.jpg"), new byte[]{1,2}, "application/octet-stream"))
                .isInstanceOf(IOException.class);
        assertThatThrownBy(() -> importer.storeResponse("0019", document, new byte[]{1,2}, "text/html"))
                .isInstanceOf(IOException.class);
    }

    private static ControlAsset attachment(String name) {
        return new ControlAsset("ATTACHMENT", name, "https://www.knps.or.kr/file", null, null);
    }
}
