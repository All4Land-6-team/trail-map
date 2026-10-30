package com.all4land.trailmap.domain.coursecomparison.service;

import com.all4land.trailmap.domain.courseanalysis.dto.response.CourseAnalysisResponse;
import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisService;
import com.all4land.trailmap.domain.coursecomparison.dto.response.CourseComparisonResponse;
import com.all4land.trailmap.domain.coursecomparison.error.CourseComparisonErrorCode;
import com.all4land.trailmap.domain.coursecomparison.exception.CourseComparisonException;
import com.all4land.trailmap.domain.coursecomparison.repository.CourseComparisonRepository;
import com.all4land.trailmap.domain.coursecomparison.repository.CourseComparisonRepository.CourseRow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.function.Function;

import static java.util.stream.Collectors.toMap;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class CourseComparisonService {
    private final CourseComparisonRepository repository;
    private final CourseAnalysisService analyses;

    public CourseComparisonResponse compare(List<Long> courseIds) {
        var ids = validate(courseIds);
        var courses = repository.findCourses(ids);
        if (courses.size() != ids.size()) {
            throw new CourseComparisonException(CourseComparisonErrorCode.COURSE_NOT_FOUND);
        }
        var mountain = courses.getFirst();
        if (courses.stream().anyMatch(course -> course.mountainId() != mountain.mountainId())) {
            throw new CourseComparisonException(CourseComparisonErrorCode.DIFFERENT_MOUNTAINS);
        }

        // 같은 DB 스냅샷에서 코스 기본 정보와 각 코스의 최신 분석을 묶어서 조회한다.
        var coursesById = courses.stream().collect(toMap(CourseRow::courseId, Function.identity()));
        var analysesById = analyses.getSummaries(ids).stream()
                .collect(toMap(CourseAnalysisResponse::courseId, Function.identity()));
        var ordered = ids.stream().map(id -> {
            var course = coursesById.get(id);
            return new CourseComparisonResponse.Course(id, course.courseName(), course.courseVersion(), analysesById.get(id));
        }).toList();
        return new CourseComparisonResponse(mountain.mountainId(), mountain.mountainName(), ordered);
    }

    private List<Long> validate(List<Long> courseIds) {
        if (courseIds == null || courseIds.size() < 2 || courseIds.size() > 3
                || courseIds.stream().anyMatch(id -> id == null || id <= 0)
                || new HashSet<>(courseIds).size() != courseIds.size()) {
            throw new CourseComparisonException(CourseComparisonErrorCode.INVALID_SELECTION);
        }
        return List.copyOf(courseIds);
    }
}
