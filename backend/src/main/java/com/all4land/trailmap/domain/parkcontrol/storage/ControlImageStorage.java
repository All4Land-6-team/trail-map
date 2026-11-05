package com.all4land.trailmap.domain.parkcontrol.storage;

import com.all4land.trailmap.global.config.r2.R2Properties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

/** Creates temporary read URLs for images already stored by the collector. */
@Component @RequiredArgsConstructor
public class ControlImageStorage {
    private final S3Presigner presigner;
    private final R2Properties properties;
    public String readUrl(String key) {
        return presigner.presignGetObject(GetObjectPresignRequest.builder().signatureDuration(properties.readUrlExpiration())
                .getObjectRequest(GetObjectRequest.builder().bucket(properties.bucketName()).key(key).build()).build()).url().toString();
    }
}
