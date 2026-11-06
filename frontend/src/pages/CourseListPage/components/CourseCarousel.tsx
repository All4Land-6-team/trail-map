import { useEffect, useLayoutEffect, useRef, type PointerEvent } from "react";
import { CourseCard } from "../../../components/content";
import type { Course } from "../../../types/course";
import { COURSE_DIFFICULTY_LABELS, formatCourseDuration } from "../../../utils/courseDiscovery";
import { createSettledSelection } from "../../../utils/settledCarouselSelection";
import { canScheduleCourse } from "../../../utils/courseIdentity";

type Props = {
  courses: readonly Course[];
  selectedId: string;
  selectionRevision?: number;
  savedIds: readonly string[];
  scheduledIds: readonly string[];
  onSelect: (id: string) => void;
  onSave: (id: string, saved: boolean) => void;
  onSchedule: (course: Course) => void;
  onOpen: (course: Course) => void;
};

export function CourseCarousel({ courses, selectedId, selectionRevision = 0, savedIds, scheduledIds, onSelect, onSave, onSchedule, onOpen }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lastScrollSelection = useRef<string | null>(null);
  const drag = useRef<{ x: number; left: number; pointerId: number } | null>(null);
  const latest = useRef({ courses, selectedId, onSelect });
  const previousCourses = useRef(courses);
  const previousRevision = useRef(selectionRevision);
  const selectionRef = useRef<ReturnType<typeof createSettledSelection> | null>(null);
  useLayoutEffect(() => {
    const selection = createSettledSelection(() => {
      const track = trackRef.current;
      if (!track || track.children.length === 0) return;
      const start = track.getBoundingClientRect().left + 18;
      const distances = [...track.children].map(card => Math.abs(card.getBoundingClientRect().left - start));
      return latest.current.courses[distances.indexOf(Math.min(...distances))]?.id;
    }, id => {
      if (id === latest.current.selectedId) return;
      lastScrollSelection.current = id;
      latest.current.onSelect(id);
    });
    selectionRef.current = selection;
    return () => { selection.cancel(); selectionRef.current = null; };
  }, []);

  useLayoutEffect(() => {
    latest.current = { courses, selectedId, onSelect };
  });
  useLayoutEffect(() => {
    selectionRef.current?.cancel();
    drag.current = null;
    const track = trackRef.current;
    const sameCourses = previousCourses.current === courses;
    const sameRevision = previousRevision.current === selectionRevision;
    previousCourses.current = courses;
    previousRevision.current = selectionRevision;
    if (!track || (sameCourses && sameRevision && lastScrollSelection.current === selectedId)) return;
    const index = courses.findIndex(course => course.id === selectedId);
    const card = track.children[index] as HTMLElement | undefined;
    if (card) track.scrollTo({ left: track.scrollLeft + card.getBoundingClientRect().left - track.getBoundingClientRect().left - 18, behavior: "instant" });
    lastScrollSelection.current = selectedId;
  }, [selectedId, selectionRevision, courses]);
  useEffect(() => {
    const track = trackRef.current;
    const selection = selectionRef.current;
    if (!selection) return;
    const finishInteraction = () => { drag.current = null; selection.endInteraction(); };
    track?.addEventListener("scrollend", selection.settle);
    window.addEventListener("pointerup", finishInteraction);
    window.addEventListener("pointercancel", finishInteraction);
    return () => {
      track?.removeEventListener("scrollend", selection.settle);
      window.removeEventListener("pointerup", finishInteraction);
      window.removeEventListener("pointercancel", finishInteraction);
      selection.cancel();
    };
  }, []);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.isPrimary) selectionRef.current?.beginInteraction();
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
    selectionRef.current?.endInteraction();
  }

  return <div ref={trackRef} className="course-carousel" role="region" aria-roledescription="캐러셀" aria-label="코스 카드"
    onScroll={() => selectionRef.current?.schedule()} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}>
    {courses.map((course, index) => <div key={course.id} className="course-carousel__item"
      role="group" aria-roledescription="슬라이드" aria-label={`${index + 1} / ${courses.length}: ${course.name}`}
      data-course-id={course.id} data-selected={course.id === selectedId}>
      <CourseCard title={course.name} route={course.routeLabel}
        difficulty={course.difficulty ? COURSE_DIFFICULTY_LABELS[course.difficulty] : "난이도 정보 없음"}
        controlStatus="통제 확인 필요" distance={`${course.distanceKm.toFixed(2)} km`} duration={formatCourseDuration(course.durationMinutes)}
        elevationGain={course.elevationGainMeters == null ? "—" : `${course.elevationGainMeters} m`}
        peakElevation={course.peakElevationMeters == null ? "—" : `${course.peakElevationMeters} m`}
        detailsAvailable={course.detailAvailable} scheduleAvailable={canScheduleCourse(course)} saved={savedIds.includes(course.id)} scheduled={scheduledIds.includes(course.id)}
        onSavedChange={saved => onSave(course.id, saved)} onScheduledChange={() => onSchedule(course)} onOpen={() => onOpen(course)} />
    </div>)}
  </div>;
}
