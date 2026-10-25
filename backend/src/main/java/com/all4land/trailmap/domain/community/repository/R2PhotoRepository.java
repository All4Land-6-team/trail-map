package com.all4land.trailmap.domain.community.repository;

import com.all4land.trailmap.global.config.r2.R2Properties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.OffsetDateTime;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class R2PhotoRepository {

    private final S3Client r2Client;
    private final S3Presigner r2Presigner;
    private final R2Properties properties;

    public R2UploadUrl createUploadUrl(String objectKey, String mediaType) {
        var putObject = PutObjectRequest.builder()
                .bucket(properties.bucketName())
                .key(objectKey)
                .contentType(mediaType)
                .build();
        var request = PutObjectPresignRequest.builder()
                .signatureDuration(properties.uploadUrlExpiration())
                .putObjectRequest(putObject)
                .build();
        return new R2UploadUrl(
                r2Presigner.presignPutObject(request).url().toString(),
                OffsetDateTime.now().plus(properties.uploadUrlExpiration())
        );
    }

    public String createReadUrl(String objectKey) {
        var getObject = GetObjectRequest.builder()
                .bucket(properties.bucketName())
                .key(objectKey)
                .build();
        var request = GetObjectPresignRequest.builder()
                .signatureDuration(properties.readUrlExpiration())
                .getObjectRequest(getObject)
                .build();
        return r2Presigner.presignGetObject(request).url().toString();
    }

    public Optional<R2ObjectMetadata> findMetadata(String objectKey) {
        try {
            var response = r2Client.headObject(HeadObjectRequest.builder()
                    .bucket(properties.bucketName())
                    .key(objectKey)
                    .build());
            return Optional.of(new R2ObjectMetadata(response.contentLength(), response.contentType()));
        } catch (NoSuchKeyException exception) {
            return Optional.empty();
        } catch (S3Exception exception) {
            if (exception.statusCode() == 404) {
                return Optional.empty();
            }
            throw exception;
        }
    }
}
