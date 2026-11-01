package com.all4land.trailmap.domain.courseroute.service;

import com.all4land.trailmap.domain.courseroute.exception.CourseRouteException;
import com.all4land.trailmap.domain.courseroute.repository.CourseRouteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.file.Path;
import static com.all4land.trailmap.domain.courseroute.error.CourseRouteErrorCode.*;

@Service
@RequiredArgsConstructor
public class CourseRouteImportService {
    public static final String DATASET_KEY = "bukhansan-13-candidate";
    private final CourseRouteDocumentReader reader;
    private final CourseRouteRepository repository;
    public record ImportResult(long sourceId, int inserted, int existing) {}

    @Transactional
    public ImportResult importFile(Path path, long bukhansanMountainId, long dobongsanMountainId) {
        if (bukhansanMountainId <= 0 || dobongsanMountainId <= 0 || bukhansanMountainId == dobongsanMountainId)
            throw new CourseRouteException(INVALID_DOCUMENT);
        var document = reader.read(path);
        repository.lockImport();
        if (!repository.mountainsExist(bukhansanMountainId, dobongsanMountainId)) throw new CourseRouteException(INVALID_DOCUMENT);
        var existing = repository.findDataset(DATASET_KEY);
        if (existing.isPresent()) {
            var dataset = existing.get();
            if (!dataset.hash().equals(document.fileHash()) || dataset.bukhansanId() != bukhansanMountainId
                    || dataset.dobongsanId() != dobongsanMountainId) throw new CourseRouteException(IMPORT_CONFLICT);
            for (var route : document.routes()) {
                long mountainId = "dobongsan".equals(route.mountainKey()) ? dobongsanMountainId : bukhansanMountainId;
                if (!repository.matchesStored(dataset.sourceId(), mountainId, route)) throw new CourseRouteException(IMPORT_CONFLICT);
            }
            return new ImportResult(dataset.sourceId(), 0, document.routes().size());
        }
        long sourceId = repository.insertDataset(DATASET_KEY, document.fileHash(), bukhansanMountainId, dobongsanMountainId);
        for (var route : document.routes()) {
            long mountainId = "dobongsan".equals(route.mountainKey()) ? dobongsanMountainId : bukhansanMountainId;
            repository.insertRoute(DATASET_KEY, sourceId, mountainId, route);
        }
        return new ImportResult(sourceId, document.routes().size(), 0);
    }
}
