package com.all4land.trailmap.domain.community.service;

import com.all4land.trailmap.domain.community.dto.request.CommunityPhotoConfirmRequest;
import com.all4land.trailmap.domain.community.dto.request.CommunityPhotoUploadUrlRequest;
import com.all4land.trailmap.domain.community.entity.CommunityPhotoTargetType;
import com.all4land.trailmap.domain.community.entity.Photo;
import com.all4land.trailmap.domain.community.error.CommunityErrorCode;
import com.all4land.trailmap.domain.community.exception.CommunityException;
import com.all4land.trailmap.domain.community.repository.map.CommunityMapQueryRepository;
import com.all4land.trailmap.domain.community.repository.photo.CommunityPhotoQueryRepository;
import com.all4land.trailmap.domain.community.repository.photo.CommunityPhotoTargetRepository;
import com.all4land.trailmap.domain.community.repository.photo.PhotoRepository;
import com.all4land.trailmap.domain.community.repository.result.CommunityPhotoQueryResult;
import com.all4land.trailmap.domain.community.repository.result.CommunityPhotoTargetQueryResult;
import com.all4land.trailmap.domain.community.repository.review.CommunityReviewQueryRepository;
import com.all4land.trailmap.domain.community.repository.spot.CommunitySpotQueryRepository;
import com.all4land.trailmap.domain.community.storage.R2ObjectMetadata;
import com.all4land.trailmap.domain.community.storage.R2PhotoStorage;
import com.all4land.trailmap.domain.community.storage.R2UploadUrl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class CommunityPhotoServiceTest {

    private static final long USER_ID = 7L;
    private static final long REVIEW_ID = 11L;
    private static final long MOUNTAIN_ID = 3L;

    @Mock
    CommunityMapQueryRepository mapQueryRepository;

    @Mock
    CommunityReviewQueryRepository reviewQueryRepository;

    @Mock
    CommunitySpotQueryRepository spotQueryRepository;

    @Mock
    CommunityPhotoTargetRepository targetRepository;

    @Mock
    CommunityPhotoQueryRepository photoQueryRepository;

    @Mock
    PhotoRepository photoRepository;

    @Mock
    R2PhotoStorage r2PhotoStorage;

    CommunityPhotoService photoService;

    @BeforeEach
    void setUp() {
        photoService = new CommunityPhotoService(
                mapQueryRepository,
                reviewQueryRepository,
                spotQueryRepository,
                targetRepository,
                photoQueryRepository,
                photoRepository,
                r2PhotoStorage
        );
        given(reviewQueryRepository.existsUser(USER_ID)).willReturn(true);
    }

    @Test
    void 본인_산_후기에_업로드할_R2_URL을_발급한다() {
        given(targetRepository.findTarget(CommunityPhotoTargetType.MOUNTAIN_REVIEW, REVIEW_ID))
                .willReturn(Optional.of(mountainReviewTarget(USER_ID)));
        var expiresAt = OffsetDateTime.parse("2026-10-25T10:10:00+09:00");
        given(r2PhotoStorage.createUploadUrl(any(), any()))
                .willReturn(new R2UploadUrl("https://upload.test", expiresAt));

        var response = photoService.requestUploadUrl(USER_ID, uploadRequest());

        assertThat(response.objectKey())
                .startsWith("community/mountain/3/11/")
                .endsWith(".jpg");
        assertThat(response.uploadUrl()).isEqualTo("https://upload.test");
        assertThat(response.expiresAt()).isEqualTo(expiresAt);
    }

    @Test
    void 사용자_스팟_사진은_커뮤니티_스팟_경로에_저장한다() {
        long spotId = 13L;
        given(targetRepository.findTarget(CommunityPhotoTargetType.USER_SPOT, spotId))
                .willReturn(Optional.of(new CommunityPhotoTargetQueryResult(
                        CommunityPhotoTargetType.USER_SPOT, spotId, USER_ID, "user-spot", spotId
                )));
        given(r2PhotoStorage.createUploadUrl(any(), any()))
                .willReturn(new R2UploadUrl("https://upload.test", OffsetDateTime.now()));

        var response = photoService.requestUploadUrl(USER_ID, new CommunityPhotoUploadUrlRequest(
                CommunityPhotoTargetType.USER_SPOT, spotId, "스팟.jpg", "image/jpeg", 1024L, 0
        ));

        assertThat(response.objectKey())
                .startsWith("community/spot/user-spot/13/")
                .endsWith(".jpg");
    }

    @Test
    void 다른_사용자의_후기에는_사진을_연결할_수_없다() {
        given(targetRepository.findTarget(CommunityPhotoTargetType.MOUNTAIN_REVIEW, REVIEW_ID))
                .willReturn(Optional.of(mountainReviewTarget(99L)));

        assertThatThrownBy(() -> photoService.requestUploadUrl(USER_ID, uploadRequest()))
                .isInstanceOfSatisfying(CommunityException.class, exception ->
                        assertThat(exception.getResponseCode()).isEqualTo(CommunityErrorCode.PHOTO_FORBIDDEN));
    }

    @Test
    void 대상에_사진이_세_장이면_추가_URL을_발급하지_않는다() {
        given(targetRepository.findTarget(CommunityPhotoTargetType.MOUNTAIN_REVIEW, REVIEW_ID))
                .willReturn(Optional.of(mountainReviewTarget(USER_ID)));
        given(photoRepository.countByMountainReviewIdAndDeletedAtIsNull(REVIEW_ID)).willReturn(3L);

        assertThatThrownBy(() -> photoService.requestUploadUrl(USER_ID, uploadRequest()))
                .isInstanceOfSatisfying(CommunityException.class, exception ->
                        assertThat(exception.getResponseCode()).isEqualTo(CommunityErrorCode.PHOTO_LIMIT_EXCEEDED));
    }

    @Test
    void R2_객체의_크기나_MIME이_요청과_다르면_확정하지_않는다() {
        String objectKey = objectKey();
        given(targetRepository.lockTarget(CommunityPhotoTargetType.MOUNTAIN_REVIEW, REVIEW_ID))
                .willReturn(Optional.of(mountainReviewTarget(USER_ID)));
        given(r2PhotoStorage.findMetadata(objectKey))
                .willReturn(Optional.of(new R2ObjectMetadata(999L, "image/png")));

        assertThatThrownBy(() -> photoService.confirmPhoto(USER_ID, confirmRequest(objectKey)))
                .isInstanceOfSatisfying(CommunityException.class, exception ->
                        assertThat(exception.getResponseCode()).isEqualTo(CommunityErrorCode.INVALID_PHOTO));
    }

    @Test
    void R2_업로드를_확인한_뒤_사진_메타데이터를_저장한다() {
        String objectKey = objectKey();
        given(targetRepository.lockTarget(CommunityPhotoTargetType.MOUNTAIN_REVIEW, REVIEW_ID))
                .willReturn(Optional.of(mountainReviewTarget(USER_ID)));
        given(r2PhotoStorage.findMetadata(objectKey))
                .willReturn(Optional.of(new R2ObjectMetadata(1024L, "image/jpeg")));
        given(photoRepository.saveAndFlush(any(Photo.class))).willAnswer(invocation -> {
            Photo photo = invocation.getArgument(0);
            ReflectionTestUtils.setField(photo, "photoId", 31L);
            return photo;
        });
        var createdAt = OffsetDateTime.parse("2026-10-25T10:00:00+09:00");
        given(photoQueryRepository.findPhoto(31L)).willReturn(Optional.of(new CommunityPhotoQueryResult(
                31L, objectKey, "북한산.jpg", "image/jpeg", 1024L, 0,
                "산길친구", "전망이 좋아요", createdAt
        )));
        given(r2PhotoStorage.createReadUrl(objectKey)).willReturn("https://read.test/photo");

        var response = photoService.confirmPhoto(USER_ID, confirmRequest(objectKey));

        assertThat(response.photoId()).isEqualTo(31L);
        assertThat(response.url()).isEqualTo("https://read.test/photo");
        assertThat(response.reviewContent()).isEqualTo("전망이 좋아요");
    }

    private static CommunityPhotoUploadUrlRequest uploadRequest() {
        return new CommunityPhotoUploadUrlRequest(
                CommunityPhotoTargetType.MOUNTAIN_REVIEW,
                REVIEW_ID,
                "북한산.jpg",
                "image/jpeg",
                1024L,
                0
        );
    }

    private static CommunityPhotoConfirmRequest confirmRequest(String objectKey) {
        return new CommunityPhotoConfirmRequest(
                CommunityPhotoTargetType.MOUNTAIN_REVIEW,
                REVIEW_ID,
                objectKey,
                "북한산.jpg",
                "image/jpeg",
                1024L,
                0
        );
    }

    private static CommunityPhotoTargetQueryResult mountainReviewTarget(Long ownerUserId) {
        return new CommunityPhotoTargetQueryResult(
                CommunityPhotoTargetType.MOUNTAIN_REVIEW,
                REVIEW_ID,
                ownerUserId,
                "mountain",
                MOUNTAIN_ID
        );
    }

    private static String objectKey() {
        return "community/mountain/3/11/550e8400-e29b-41d4-a716-446655440000.jpg";
    }
}
