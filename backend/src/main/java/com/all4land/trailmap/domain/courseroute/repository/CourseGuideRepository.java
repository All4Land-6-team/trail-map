package com.all4land.trailmap.domain.courseroute.repository;

import com.all4land.trailmap.domain.courseroute.service.CourseGuideDocumentReader.Guide;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.time.LocalDate;

@Repository
@RequiredArgsConstructor
public class CourseGuideRepository {
    private final JdbcTemplate jdbc;

    /** Only fill missing metadata or replay the identical, unchanged import. Never replace geometry. */
    public boolean importGuide(String datasetKey, Guide guide, String hash) {
        var ids = jdbc.queryForList("""
                SELECT c.course_id FROM course c JOIN course_route_metadata r ON r.course_id = c.course_id
                WHERE r.dataset_key = ? AND r.source_record_id = ? AND r.mountain_key = ?
                  AND c.source_hash = ? AND c.course_version = 1
                  AND r.route_label = ? AND c.official_distance_meters = ?
                FOR UPDATE OF c
                """, Long.class, datasetKey, guide.routeRecordId(), guide.mountainKey(), guide.routeHash(),
                guide.routeLabel(), guide.distanceMeters());
        if (ids.size() != 1) throw new IllegalStateException("안내와 기존 경로의 식별자·구간·거리·지문이 다릅니다: " + guide.routeRecordId());
        long id = ids.getFirst();
        Integer existing = jdbc.queryForObject("SELECT count(*) FROM course_guide_metadata WHERE course_id = ?", Integer.class, id);
        if (existing == 1) {
            Boolean matches = jdbc.queryForObject("""
                    SELECT EXISTS (SELECT 1 FROM course_guide_metadata g JOIN course c USING (course_id)
                    WHERE g.course_id = ? AND g.document_hash = ? AND g.route_source_hash = c.source_hash
                      AND g.course_version = c.course_version AND g.distance_meters = c.official_distance_meters
                      AND g.duration_seconds = c.official_duration_seconds AND c.course_difficulty = ?
                      AND g.official_course_id = ? AND g.route_label = ? AND g.difficulty_grade = ?
                      AND g.distance_meters = ? AND g.duration_seconds = ? AND g.source_url = ? AND g.checked_on = ?)
                    """, Boolean.class, id, hash, guide.difficulty(), guide.officialCourseId(), guide.routeLabel(),
                    guide.difficultyGrade(), guide.distanceMeters(), guide.durationSeconds(), guide.sourceUrl(), Date.valueOf(guide.checkedOn()));
            if (!Boolean.TRUE.equals(matches)) throw new IllegalStateException("기존 안내 정보와 다릅니다: " + guide.routeRecordId());
            return false;
        }
        int updated = jdbc.update("""
                UPDATE course SET official_duration_seconds = ?, course_difficulty = ?, updated_at = CURRENT_TIMESTAMP
                WHERE course_id = ? AND official_duration_seconds IS NULL AND course_difficulty IS NULL
                """, guide.durationSeconds(), guide.difficulty(), id);
        if (updated != 1) throw new IllegalStateException("기존 시간·난이도는 덮어쓰지 않습니다: " + guide.routeRecordId());
        jdbc.update("""
                INSERT INTO course_guide_metadata (course_id, course_version, route_source_hash, official_course_id,
                    route_label, difficulty_grade, distance_meters, duration_seconds, source_url, checked_on, document_hash)
                VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, guide.routeHash(), guide.officialCourseId(), guide.routeLabel(), guide.difficultyGrade(),
                guide.distanceMeters(), guide.durationSeconds(), guide.sourceUrl(), Date.valueOf(LocalDate.parse(guide.checkedOn())), hash);
        return true;
    }
}
