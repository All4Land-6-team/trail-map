package com.all4land.trailmap.domain.courseanalysis.service;

import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisProfileResponse;
import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse;
import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse.*;
import com.all4land.trailmap.domain.courseanalysis.entity.AnalysisQualityStatus;
import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository.AnalysisRow;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader.Stored;
import com.all4land.trailmap.domain.courseanalysis.storage.CourseAnalysisFileStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import static com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader.close;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CourseAnalysisService {
    private final CourseAnalysisRepository repository;
    private final CourseAnalysisFileStore store;
    private final CourseAnalysisDocumentReader reader;

    public CourseAnalysisResponse getSummary(long courseId) {
        positive(courseId);
        var course = repository.findCourse(courseId)
                .orElseThrow(() -> new CourseAnalysisException(CourseAnalysisErrorCode.COURSE_NOT_FOUND));
        return repository.findLatest(courseId).map(row -> response(row, loadVerified(row)))
                .orElseGet(() -> new CourseAnalysisResponse(course.courseId(), course.mountainId(), course.courseVersion(),
                        null, null, null, null, null, null, AnalysisQualityStatus.NO_DATA, null,
                        List.of("ANALYSIS_NOT_FOUND"), null, new Metrics(null, null, null, null, null, null, null),
                        null, null, null));
    }

    public CourseAnalysisProfileResponse getProfile(long analysisId) {
        positive(analysisId);
        var row = repository.findById(analysisId)
                .orElseThrow(() -> new CourseAnalysisException(CourseAnalysisErrorCode.ANALYSIS_NOT_FOUND));
        var stored = loadVerified(row);
        var samples = stored.document().profile().stream().map(sample -> new CourseAnalysisProfileResponse.Sample(
                sample.sampleIndex(), sample.distanceMeters(), List.of(sample.longitude(), sample.latitude()),
                sample.elevationMeters(), sample.slopePercent(), sample.sampleStatus())).toList();
        return new CourseAnalysisProfileResponse(response(row, stored), samples);
    }

    /** 요약 행과 파일이 다른 경우 값을 혼합해 반환하지 않는다. */
    public Stored loadVerified(AnalysisRow row) {
        var stored = store.load(row.analysisId());
        var document = stored.document();
        var summary = document.summary();
        var metrics = row.metrics();
        if (stored.analysisId() != row.analysisId() || stored.demSourceId() != row.demSourceId()
                || document.course().courseId() != row.courseId() || document.course().courseVersion() != row.courseVersion()
                || !document.algorithmVersion().equals(row.algorithmVersion())
                || !document.sourceType().equals(row.sourceType()) || document.qualityStatus() != row.qualityStatus()
                || row.calculatedAt() == null
                || !document.calculatedAt().truncatedTo(ChronoUnit.MICROS).isEqual(row.calculatedAt())
                || !reader.sameGeometry(document.course().geometry(), row.snapshotGeometry())
                || !close(summary.distanceMeters(), metrics.distanceMeters())
                || !close(summary.minElevationMeters(), metrics.minElevationMeters())
                || !close(summary.maxElevationMeters(), metrics.maxElevationMeters())
                || !close(summary.elevationGainMeters(), metrics.elevationGainMeters())
                || !close(summary.elevationLossMeters(), metrics.elevationLossMeters())) {
            throw new CourseAnalysisException(CourseAnalysisErrorCode.DATA_UNAVAILABLE);
        }
        return stored;
    }

    private CourseAnalysisResponse response(AnalysisRow row, Stored stored) {
        var document = stored.document();
        var summary = document.summary();
        var settings = document.settings();
        var reasons = new ArrayList<>(document.qualityReasons());
        boolean outdated = false;
        if (!row.versionCurrent()) { reasons.add("COURSE_VERSION_CHANGED"); outdated = true; }
        if (!row.geometryCurrent()) { reasons.add("COURSE_GEOMETRY_CHANGED"); outdated = true; }
        if (document.course().mountainId() != row.mountainId()) { reasons.add("COURSE_MOUNTAIN_CHANGED"); outdated = true; }
        if (document.course().sourceId() != null && !Objects.equals(document.course().sourceId(), row.currentSourceId())) {
            reasons.add("COURSE_SOURCE_CHANGED"); outdated = true;
        }
        return new CourseAnalysisResponse(row.courseId(), row.mountainId(), row.currentCourseVersion(), row.analysisId(),
                row.courseVersion(), row.demSourceId(), row.algorithmVersion(), row.sourceType(), document.course().sourceKind(),
                outdated ? AnalysisQualityStatus.OUTDATED : row.qualityStatus(), row.qualityStatus(), List.copyOf(reasons),
                row.calculatedAt(), row.metrics(),
                new Coverage(summary.sampleCount(), summary.validDemSampleCount(), summary.validElevationMetersSampleCount(),
                        summary.sampleCoveragePercent(), summary.coveredDistanceMeters(), summary.distanceCoveragePercent(),
                        summary.analyzedSegmentCount()),
                new Settings(settings.sampleIntervalMeters(), settings.samplingMethod(), settings.resamplingMethod(),
                        settings.distanceMethod(), settings.elevationUnit(), settings.elevationUnitSource(),
                        settings.verticalReference(), settings.elevationProcessing(), settings.slopeConvention()),
                "/api/v1/course-analyses/" + row.analysisId() + "/profile");
    }

    private void positive(long id) {
        if (id <= 0) throw new CourseAnalysisException(CourseAnalysisErrorCode.INVALID_IDENTIFIER);
    }
}
