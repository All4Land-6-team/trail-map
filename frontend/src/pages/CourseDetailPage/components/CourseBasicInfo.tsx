import type { Course } from "../../../types/course";
import { COURSE_DIFFICULTY_LABELS, formatCourseDuration } from "../../../utils/courseDiscovery";

/** Visitor guidance remains usable even when DEM analysis has not been generated. */
export function CourseBasicInfo({ course }: { course: Course }) {
  return <section className="course-basic-info" aria-label="코스 기본 정보">
    <p className="course-basic-info__route">{course.guide?.routeLabel ?? course.routeLabel}</p>
    <dl>
      <div><dt>난이도</dt><dd>{course.difficulty ? COURSE_DIFFICULTY_LABELS[course.difficulty] : "정보 없음"}
        {course.guide && <small>공식 등급 {course.guide.difficultyGrade}</small>}</dd></div>
      <div><dt>안내 소요 시간</dt><dd>{formatCourseDuration(course.durationMinutes)}</dd></div>
      <div><dt>경로 길이</dt><dd>{course.distanceKm.toFixed(2)} km</dd></div>
      <div><dt>공식 안내 거리</dt><dd>{course.officialDistanceMeters == null ? "정보 없음" : `${(course.officialDistanceMeters / 1000).toFixed(1)} km`}</dd></div>
    </dl>
  </section>;
}
