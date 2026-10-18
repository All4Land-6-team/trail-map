import { useEffect, useRef, type PointerEvent } from "react";
import { CourseCard } from "../../../components/content";
import type { Course } from "../../../types/course";
import { COURSE_DIFFICULTY_LABELS, formatCourseDuration } from "../../../utils/courseDiscovery";

type Props = {
  courses: readonly Course[];
  selectedId: string;
  savedIds: readonly string[];
  scheduledIds: readonly string[];
  onSelect: (id: string) => void;
  onSave: (id: string, saved: boolean) => void;
  onSchedule: (course: Course) => void;
  onOpen: (course: Course) => void;
};

export function CourseCarousel({ courses, selectedId, savedIds, scheduledIds, onSelect, onSave, onSchedule, onOpen }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lastScrollSelection = useRef<string | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const drag = useRef<{ x: number; left: number; pointerId: number } | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || lastScrollSelection.current === selectedId) return;
    const index = courses.findIndex(course => course.id === selectedId);
    const card = track.children[index] as HTMLElement | undefined;
    if (card) track.scrollTo({ left: track.scrollLeft + card.getBoundingClientRect().left - track.getBoundingClientRect().left - 18, behavior: "instant" });
    lastScrollSelection.current = selectedId;
  }, [selectedId, courses]);
  useEffect(() => () => { if (scrollFrame.current != null) cancelAnimationFrame(scrollFrame.current); }, []);

  function handleScroll() {
    if (scrollFrame.current != null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const start = track.getBoundingClientRect().left + 18;
      const distances = [...track.children].map(card => Math.abs(card.getBoundingClientRect().left - start));
      const index = distances.indexOf(Math.min(...distances));
      const id = courses[index]?.id;
      if (id && id !== lastScrollSelection.current) {
        lastScrollSelection.current = id;
        onSelect(id);
      }
    });
  }
  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, pointerId: event.pointerId };
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || Math.abs(event.clientX - start.x) < 5) return;
    event.currentTarget.setPointerCapture(start.pointerId);
    event.currentTarget.scrollLeft = start.left - (event.clientX - start.x);
  }
  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current && event.currentTarget.hasPointerCapture(drag.current.pointerId)) event.currentTarget.releasePointerCapture(drag.current.pointerId);
    drag.current = null;
  }

  return <div ref={trackRef} className="course-carousel" role="region" aria-roledescription="캐러셀" aria-label="코스 카드"
    onScroll={handleScroll} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
    {courses.map((course, index) => <div key={course.id} className="course-carousel__item"
      role="group" aria-roledescription="슬라이드" aria-label={`${index + 1} / ${courses.length}: ${course.name}`}
      data-course-id={course.id} data-selected={course.id === selectedId}>
      <CourseCard title={course.name} route={course.routeLabel}
        difficulty={course.difficulty ? COURSE_DIFFICULTY_LABELS[course.difficulty] : "분석 준비 중"}
        controlStatus="통제 확인 필요" distance={`${course.distanceKm} km`} duration={formatCourseDuration(course.durationMinutes)}
        elevationGain={course.elevationGainMeters == null ? "—" : `${course.elevationGainMeters} m`}
        peakElevation={course.peakElevationMeters == null ? "—" : `${course.peakElevationMeters} m`}
        detailsAvailable={course.detailAvailable} saved={savedIds.includes(course.id)} scheduled={scheduledIds.includes(course.id)}
        onSavedChange={saved => onSave(course.id, saved)} onScheduledChange={() => onSchedule(course)} onOpen={() => onOpen(course)} />
    </div>)}
  </div>;
}
