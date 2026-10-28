package com.all4land.trailmap.domain.courseanalysis.service;

import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.domain.courseanalysis.exception.CourseAnalysisException;
import com.all4land.trailmap.domain.courseanalysis.repository.CourseAnalysisRepository;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader.Stored;
import com.all4land.trailmap.domain.courseanalysis.storage.CourseAnalysisFileStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;

@Service
@RequiredArgsConstructor
public class CourseAnalysisImportService {
    private final CourseAnalysisRepository repository;
    private final CourseAnalysisDocumentReader reader;
    private final CourseAnalysisFileStore store;
    private final CourseAnalysisService queries;

    public record ImportResult(long analysisId, long demSourceId, boolean inserted) {}

    @Transactional
    public ImportResult importFile(Path path, String sourceName, String provider) {
        if (sourceName == null || sourceName.isBlank() || sourceName.length() > 200
                || provider != null && provider.length() > 200) {
            throw new CourseAnalysisException(CourseAnalysisErrorCode.INVALID_DOCUMENT);
        }
        var validated = reader.read(path);
        var document = validated.document();
        String geometry = reader.geometryJson(document.course().geometry());
        var course = repository.lockCourse(document.course().courseId(), geometry)
                .orElseThrow(() -> new CourseAnalysisException(CourseAnalysisErrorCode.COURSE_NOT_FOUND));
        if (course.mountainId() != document.course().mountainId() || course.courseVersion() != document.course().courseVersion()
                || !course.geometryMatches()
                || document.course().sourceId() != null && course.sourceId() != document.course().sourceId()) {
            throw new CourseAnalysisException(CourseAnalysisErrorCode.COURSE_CHANGED);
        }
        var authority = document.inputs().dem().crsAuthority();
        String crs = authority == null ? "CUSTOM_WKT" : String.join(":", authority);
        long demId = repository.findOrCreateDemSource(sourceName.strip(),
                provider == null || provider.isBlank() ? null : provider.strip(),
                reader.demVersion(document.inputs().dem(), document.settings()), crs);
        var existing = repository.findExisting(course.courseId(), course.courseVersion(), demId, document.algorithmVersion());
        if (existing.isPresent()) {
            var stored = queries.loadVerified(existing.get());
            if (!reader.sameResult(stored.document(), document)) {
                throw new CourseAnalysisException(CourseAnalysisErrorCode.RESULT_CONFLICT);
            }
            return new ImportResult(existing.get().analysisId(), demId, false);
        }
        long id = repository.insert(document, demId, geometry);
        store.publish(new Stored(id, demId, validated.hash(), document));
        return new ImportResult(id, demId, true);
    }
}
