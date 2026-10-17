import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "../../../components/common/Button";
import { Icon } from "../../../components/common/Icon";
import { Typography } from "../../../components/common/Typography";
import { BottomSheet } from "../../../components/overlay";
import type { Course, CourseFilters, CourseSort, DetailedCourseFilters } from "../../../types/course";
import { changeCourseDistance, COURSE_DURATION_LABELS, DEFAULT_COURSE_FILTERS, selectCourses } from "../../../utils/courseDiscovery";

type Props = {
  courses: readonly Course[];
  filters: CourseFilters;
  sort: CourseSort;
  onApply: (filters: DetailedCourseFilters) => void;
  onClose: () => void;
};

export function CourseFilterSheet({ courses, filters, sort, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<DetailedCourseFilters>(() => ({ ...filters }));
  const dialogRef = useRef<HTMLDivElement>(null);
  const count = selectCourses(courses, { ...draft, difficulty: filters.difficulty }, sort).length;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", handleKey, true);
    return () => { document.removeEventListener("keydown", handleKey, true); };
  }, [onClose]);

  const content = <div className="course-filter__fields">
    <fieldset className="course-filter__group">
      <legend><Typography variant="controlLabel">예상 소요 시간</Typography></legend>
      <div className="course-filter__choices">
        {(["all", "under2", "2to4"] as const).map(value => <Button key={value}
          className="course-filter__choice" variant={draft.duration === value ? "primary" : "secondary"}
          aria-pressed={draft.duration === value} onClick={() => setDraft(current => ({ ...current, duration: value }))}>
          {COURSE_DURATION_LABELS[value]}
        </Button>)}
      </div>
    </fieldset>
    <fieldset className="course-filter__group course-filter__distance">
      <legend><Typography variant="controlLabel">거리</Typography></legend>
      <output className="course-filter__distance-value" aria-live="polite">{draft.minDistanceKm}~{draft.maxDistanceKm} km</output>
      <div className="course-filter__range" style={{ "--range-min": `${draft.minDistanceKm * 10}%`, "--range-max": `${draft.maxDistanceKm * 10}%` } as CSSProperties}>
        <div className="course-filter__range-track" aria-hidden="true" />
        <input type="range" min="0" max="10" step="0.5" aria-label="최소 거리"
          aria-valuetext={`${draft.minDistanceKm} 킬로미터`} value={draft.minDistanceKm}
          onChange={event => setDraft(current => changeCourseDistance(current, "min", Number(event.target.value)))} />
        <input type="range" min="0" max="10" step="0.5" aria-label="최대 거리"
          aria-valuetext={`${draft.maxDistanceKm} 킬로미터`} value={draft.maxDistanceKm}
          onChange={event => setDraft(current => changeCourseDistance(current, "max", Number(event.target.value)))} />
      </div>
    </fieldset>
    <fieldset className="course-filter__group">
      <legend><Typography variant="controlLabel">급경사 비율</Typography></legend>
      <div className="course-filter__choices">
        {(["all", "20", "10"] as const).map(value => <Button key={value}
          className="course-filter__choice" variant={draft.steepRatio === value ? "primary" : "secondary"}
          aria-pressed={draft.steepRatio === value} onClick={() => setDraft(current => ({ ...current, steepRatio: value }))}>
          {value === "all" ? "전체" : `${value}% 이하`}
        </Button>)}
      </div>
    </fieldset>
  </div>;

  return <div className="course-filter-layer" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="코스 필터" className="course-filter-dialog">
      <BottomSheet title="코스 필터" onClose={onClose} showDescription={false} showFooter className="course-filter"
        content={content} footer={<div className="course-filter__actions">
          <Button variant="secondary" onClick={() => setDraft({ ...DEFAULT_COURSE_FILTERS })}
            trailingIcon={<Icon name="ArrowRight" size={17} color="currentColor" />}>초기화</Button>
          <Button onClick={() => onApply(draft)} trailingIcon={<Icon name="ArrowRight" size={17} color="currentColor" />}>
            {count}개 코스 보기
          </Button>
        </div>} />
    </div>
  </div>;
}
