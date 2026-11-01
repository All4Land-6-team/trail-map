package com.all4land.trailmap.domain.courseroute.service;

import com.all4land.trailmap.domain.courseroute.repository.CourseGuideRepository;
import com.all4land.trailmap.domain.courseroute.repository.CourseRouteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.file.Path;

@Service
@RequiredArgsConstructor
public class CourseGuideImportService {
    private final CourseGuideDocumentReader reader;
    private final CourseGuideRepository repository;
    private final CourseRouteRepository routes;
    public record Result(int inserted, int existing) {}

    @Transactional
    public Result importFile(Path path) {
        var document = reader.read(path);
        routes.lockImport();
        int inserted = 0;
        for (var guide : document.input().courses()) {
            if (repository.importGuide(document.input().datasetKey(), guide, document.hash())) inserted++;
        }
        return new Result(inserted, document.input().courses().size() - inserted);
    }
}
