package com.all4land.trailmap.domain.community.service;

import com.all4land.trailmap.domain.community.exception.CommunityException;
import com.all4land.trailmap.domain.community.repository.map.CommunityMapQueryRepository;
import com.all4land.trailmap.domain.community.repository.review.CommunityReviewQueryRepository;
import com.all4land.trailmap.domain.community.repository.spot.CommunitySpotQueryRepository;
import com.all4land.trailmap.domain.community.storage.R2PhotoStorage;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CoursePhotoSpotServiceTest {
    private final CommunityMapQueryRepository maps = mock(CommunityMapQueryRepository.class);
    private final CommunityReviewQueryRepository reviews = mock(CommunityReviewQueryRepository.class);
    private final CommunitySpotQueryRepository spots = mock(CommunitySpotQueryRepository.class);
    private final CommunityQueryService service = new CommunityQueryService(maps, reviews, spots,
            mock(CommunityPhotoService.class), mock(R2PhotoStorage.class), new com.fasterxml.jackson.databind.ObjectMapper());

    @Test
    void 코스의_실제_소속_산과_등록_코스로_조회한다() {
        when(reviews.existsUser(1L)).thenReturn(true);
        when(maps.findCourseMountainId(9L)).thenReturn(Optional.of(4L));
        when(spots.findCoursePhotoSpots(1L, 4L, 9L)).thenReturn(List.of());
        assertEquals(List.of(), service.getCoursePhotoSpots(1L, 9L));
        verify(spots).findCoursePhotoSpots(1L, 4L, 9L);
    }

    @Test
    void 없는_사용자나_코스는_스팟_조회하지_않는다() {
        assertThrows(CommunityException.class, () -> service.getCoursePhotoSpots(1L, 9L));
        when(reviews.existsUser(1L)).thenReturn(true);
        when(maps.findCourseMountainId(9L)).thenReturn(Optional.empty());
        assertThrows(CommunityException.class, () -> service.getCoursePhotoSpots(1L, 9L));
        verifyNoInteractions(spots);
    }
}
