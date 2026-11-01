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
    {course.guide && <>
      <p className="course-basic-info__note">거리·시간은 위 안내 구간 기준이며 왕복 시간이 아니에요. 지도 경로 길이와 공식 안내 거리는 다를 수 있어요.</p>
      <p className="course-basic-info__note">난이도는 코스 전체 등급이에요. 초급 코스에도 가파르거나 위험한 구간이 있을 수 있어요.</p>
      <a href={course.guide.sourceUrl} target="_blank" rel="noopener noreferrer">국립공원공단 코스 안내 ↗</a>
      <span className="course-basic-info__checked">확인일 {course.guide.checkedOn}</span>
    </>}
  </section>;
}
