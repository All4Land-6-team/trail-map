package com.all4land.trailmap.domain.coursecomparison.service;

import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse;
import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse.Metrics;
import com.all4land.trailmap.domain.courseanalysis.entity.AnalysisQualityStatus;
import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisService;
import com.all4land.trailmap.domain.coursecomparison.error.CourseComparisonErrorCode;
import com.all4land.trailmap.domain.coursecomparison.exception.CourseComparisonException;
import com.all4land.trailmap.domain.coursecomparison.repository.CourseComparisonRepository;
import com.all4land.trailmap.domain.coursecomparison.repository.CourseComparisonRepository.CourseRow;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CourseComparisonServiceTest {
    @Mock CourseComparisonRepository repository;
    @Mock CourseAnalysisService analyses;
    private CourseComparisonService service;

    @BeforeEach
    void setUp() { service = new CourseComparisonService(repository, analyses); }

    @Test
    void keepsRequestedOrderEvenWhenQueriesReturnDifferentOrders() {
        var ids = List.of(2L, 1L);
        var first = summary(1, AnalysisQualityStatus.PARTIAL);
        var second = summary(2, AnalysisQualityStatus.NO_DATA);
        when(repository.findCourses(ids)).thenReturn(List.of(course(1, 7), course(2, 7)));
        when(analyses.getSummaries(ids)).thenReturn(List.of(first, second));

        var response = service.compare(ids);

        assertThat(response.mountainId()).isEqualTo(7);
        assertThat(response.mountainName()).isEqualTo("북한산");
        assertThat(response.courses()).extracting("courseId").containsExactly(2L, 1L);
        assertThat(response.courses()).extracting("courseName").containsExactly("코스 2", "코스 1");
        assertThat(response.courses().getFirst().analysis()).isSameAs(second);
        assertThat(response.courses().getLast().analysis()).isSameAs(first);
        verify(repository).findCourses(ids); verify(analyses).getSummaries(ids);
        verifyNoMoreInteractions(repository, analyses);
    }

    @Test
    void acceptsThreeAndPreservesPerCourseQualityAndSnapshotMetadata() {
        var ids = List.of(3L, 1L, 2L);
        var outdated = summary(3, AnalysisQualityStatus.OUTDATED);
        var partial = summary(1, AnalysisQualityStatus.PARTIAL);
        var missing = summary(2, AnalysisQualityStatus.NO_DATA);
        when(repository.findCourses(ids)).thenReturn(List.of(course(1, 7), course(2, 7), course(3, 7)));
        when(analyses.getSummaries(ids)).thenReturn(List.of(partial, missing, outdated));

        var response = service.compare(ids);

        assertThat(response.courses()).hasSize(3);
        assertThat(response.courses()).extracting(item -> item.analysis().qualityStatus()).containsExactly(
                AnalysisQualityStatus.OUTDATED, AnalysisQualityStatus.PARTIAL, AnalysisQualityStatus.NO_DATA);
        assertThat(response.courses().getFirst().currentCourseVersion()).isEqualTo(2);
        assertThat(response.courses().getFirst().analysis().analyzedCourseVersion()).isEqualTo(1);
        assertThat(response.courses().getFirst().analysis()).isSameAs(outdated);
        assertThat(response.courses().get(1).analysis().profileUrl()).isEqualTo("/api/v1/course-analyses/10/profile");
        assertThat(response.courses().getLast().analysis().metrics().distanceMeters()).isNull();
    }

    @ParameterizedTest
    @MethodSource("invalidSelections")
    void invalidSelectionsFailBeforeAnyDatabaseOrAnalysisAccess(List<Long> ids) {
        assertThatThrownBy(() -> service.compare(ids)).isInstanceOfSatisfying(CourseComparisonException.class,
                error -> assertThat(error.getResponseCode()).isEqualTo(CourseComparisonErrorCode.INVALID_SELECTION));
        verifyNoInteractions(repository, analyses);
    }

    static Stream<Arguments> invalidSelections() {
        return Stream.of(Arguments.of((Object) null), Arguments.of(List.of()), Arguments.of(List.of(1L)),
                Arguments.of(List.of(1L, 2L, 3L, 4L)), Arguments.of(List.of(1L, 1L)),
                Arguments.of(List.of(1L, 2L, 1L)), Arguments.of(List.of(0L, 1L)),
                Arguments.of(List.of(-1L, 2L)), Arguments.of(Arrays.asList(1L, null)));
    }

    @Test
    void missingCourseFailsTheWholeRequestWithoutDroppingIt() {
        when(repository.findCourses(List.of(1L, 2L))).thenReturn(List.of(course(1, 7)));
        assertThatThrownBy(() -> service.compare(List.of(1L, 2L)))
                .isInstanceOfSatisfying(CourseComparisonException.class,
                        error -> assertThat(error.getResponseCode()).isEqualTo(CourseComparisonErrorCode.COURSE_NOT_FOUND));
        verifyNoInteractions(analyses);
    }

    @Test
    void coursesFromDifferentMountainsAreRejectedBeforeAnalysisAccess() {
        when(repository.findCourses(List.of(1L, 2L))).thenReturn(List.of(course(1, 7), course(2, 8)));
        assertThatThrownBy(() -> service.compare(List.of(1L, 2L)))
                .isInstanceOfSatisfying(CourseComparisonException.class,
                        error -> assertThat(error.getResponseCode()).isEqualTo(CourseComparisonErrorCode.DIFFERENT_MOUNTAINS));
        verifyNoInteractions(analyses);
    }

    @Test
    void unavailableArtifactIsNotDisguisedAsNoData() {
        var ids = List.of(1L, 2L);
        when(repository.findCourses(ids)).thenReturn(List.of(course(1, 7), course(2, 7)));
        when(analyses.getSummaries(ids)).thenThrow(new CourseAnalysisException(CourseAnalysisErrorCode.DATA_UNAVAILABLE));
        assertThatThrownBy(() -> service.compare(ids)).isInstanceOfSatisfying(CourseAnalysisException.class,
                error -> assertThat(error.getResponseCode()).isEqualTo(CourseAnalysisErrorCode.DATA_UNAVAILABLE));
    }

    private CourseRow course(long id, long mountain) {
        return new CourseRow(id, "코스 " + id, id == 3 ? 2 : 1, mountain, "북한산");
    }

    private CourseAnalysisResponse summary(long id, AnalysisQualityStatus status) {
        boolean absent = status == AnalysisQualityStatus.NO_DATA;
        return new CourseAnalysisResponse(id, 7, id == 3 ? 2 : 1, absent ? null : id * 10,
                absent ? null : 1, absent ? null : 9L, absent ? null : "course-dem-v1",
                absent ? null : "SERVICE_CALCULATED", absent ? null : "development", status,
                absent ? null : AnalysisQualityStatus.PARTIAL,
                List.of(absent ? "ANALYSIS_NOT_FOUND" : "UNVERIFIED_VERTICAL_REFERENCE"), null,
                new Metrics(absent ? null : 20.0, null, null, null, null, null, null), null, null,
                absent ? null : "/api/v1/course-analyses/" + id * 10 + "/profile");
    }
}
