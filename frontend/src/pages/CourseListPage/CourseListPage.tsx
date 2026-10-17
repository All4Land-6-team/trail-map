import { useEffect, useRef } from "react";
import { Chip } from "../../components/common/Chip";
import { Select } from "../../components/common/Select";
import { Icon } from "../../components/common/Icon";
import { Button } from "../../components/common/Button";
import { BottomNavigation, PageIndicator, TopBar, type BottomDestination } from "../../components/layout";
import { EmptyState, Toast } from "../../components/feedback";
import { BottomSheet } from "../../components/overlay";
import { coursePaths } from "../../routes/courseRoutes";
import { homePaths, navigateFromHome } from "../../routes/homeRoutes";
import { setCourseSaved, useSavedCourseIds } from "../../store/courseSelectionStore";
import type { Course, CourseDifficulty, CourseFilters, CourseRequest, DetailedCourseFilters } from "../../types/course";
import { COURSE_DIFFICULTY_LABELS, DEFAULT_COURSE_FILTERS, getCourseFilterChips, hasCourseFilters, hasDetailedCourseFilters, removeCourseFilter } from "../../utils/courseDiscovery";
import { CourseCarousel } from "./components/CourseCarousel";
import { CourseFilterSheet } from "./components/CourseFilterSheet";
import { CourseMap } from "./components/CourseMap";
import { useCourseDiscovery } from "./hooks/useCourseDiscovery";
import "./course-list.css";

export type CourseListPageProps = {
  mountainId: string;
  initialCourseId?: string;
  onBack?: () => void;
  onCourseOpen?: (request: CourseRequest) => void;
  onScheduleOpen?: (request: CourseRequest) => void;
};

export function CourseListPage({ mountainId, initialCourseId, onBack = () => navigateFromHome(homePaths.home), onCourseOpen, onScheduleOpen }: CourseListPageProps) {
  const discovery = useCourseDiscovery(mountainId, initialCourseId);
  const savedIds = useSavedCourseIds();
  const filterOpener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!discovery.filterOpen) filterOpener.current?.focus();
  }, [discovery.filterOpen]);
  const { state, courses, selectedCourse, filters, sort, notify } = discovery;

  function applyFilters(next: CourseFilters) {
    discovery.setFilters(next);
    discovery.setSelectedId(null);
  }
  function applyDetails(next: DetailedCourseFilters) {
    applyFilters({ ...next, difficulty: filters.difficulty });
    discovery.closeFilter();
  }
  function saveCourse(id: string, saved: boolean) {
    setCourseSaved(id, saved);
    notify(saved ? "장바구니에 담았어요." : "장바구니에서 뺐어요.");
  }
  function openCourse(course: Course) {
    if (!course.detailAvailable) return;
    const request = { mountainId, courseId: course.id };
    if (onCourseOpen) onCourseOpen(request);
    else {
      navigateFromHome(coursePaths.detail(request));
    }
  }
  function openSchedule(course: Course) {
    const request = { mountainId, courseId: course.id };
    if (onScheduleOpen) onScheduleOpen(request);
    else {
      navigateFromHome(coursePaths.schedule(request));
      notify("일정 등록 화면은 담당 작업과 통합 후 연결됩니다.");
    }
  }
  function navigateTab(destination: BottomDestination) {
    if (destination === "home") onBack();
    else notify("이 기능은 다음 단계에서 연결됩니다.");
  }

  if (state.status !== "success") return <main className="course-page course-page--status" aria-label="산별 코스 목록">
    <TopBar title="코스 목록" onBack={onBack} showAction={false} />
    <div className="course-page__status" aria-live="polite">
      {state.status === "loading" ? <p role="status">코스 목록을 불러오는 중이에요.</p>
        : <><EmptyState title={state.status === "missing" ? "산 정보를 찾을 수 없어요." : "코스를 불러오지 못했어요."}
          description={state.status === "missing" ? "홈에서 산을 다시 선택해 주세요." : "잠시 후 다시 시도해 주세요."} />
          <Button onClick={state.status === "missing" ? onBack : discovery.retry}>{state.status === "missing" ? "홈으로" : "다시 시도"}</Button></>}
    </div>
    <BottomNavigation active="home" onNavigate={navigateTab} className="course-page__nav" />
  </main>;

  const { mountain, courses: allCourses } = state.data;
  const activeIndex = selectedCourse ? courses.findIndex(course => course.id === selectedCourse.id) : 0;
  const selectedDifficulty = (difficulty: CourseDifficulty | "all") => difficulty === "all"
    ? !hasCourseFilters(filters) : filters.difficulty === difficulty;

  return <main className="course-page" aria-label={`${mountain.name} 코스 탐색`}>
    <div className="course-page__base" inert={discovery.filterOpen}>
      <div className="course-page__map-area">
        <CourseMap courses={courses} selected={selectedCourse} center={mountain.position}
          onSelect={discovery.setSelectedId} onNotify={notify} />
        <TopBar title={mountain.name} onBack={onBack} showAction={false} className="course-page__top" />
      </div>
      <BottomSheet title={`${mountain.name} 코스 ${courses.length}개`} showClose={false} showDescription={false}
        className="course-list-sheet" headerAction={<div className="course-list-sheet__controls">
          <Select aria-label="코스 정렬" value={sort} onChange={event => discovery.setSort(event.target.value === "name" ? "name" : "difficulty")}
            options={[{ value: "difficulty", label: "난이도별" }, { value: "name", label: "이름순" }]} />
          <Chip label="필터" variant="action" aria-haspopup="dialog" aria-expanded={discovery.filterOpen}
            icon={<Icon name="Filter" size={14} color="currentColor" />}
            onClick={event => { filterOpener.current = event.currentTarget; discovery.openFilter(); }}
            className={hasDetailedCourseFilters(filters) ? "course-list-sheet__filter course-list-sheet__filter--active" : "course-list-sheet__filter"} />
        </div>} content={<>
          <div className="course-quick-filters" aria-label="코스 필터 조건">
            {(["all", "beginner", "intermediate", "advanced"] as const).map(value => <Chip key={value}
              label={value === "all" ? "전체" : COURSE_DIFFICULTY_LABELS[value]} selected={selectedDifficulty(value)}
              onClick={() => applyFilters(value === "all" ? { ...DEFAULT_COURSE_FILTERS } : { ...filters, difficulty: value })} />)}
            {getCourseFilterChips(filters).map(chip => <Chip key={chip.key} label={`${chip.label} ×`}
              aria-label={`${chip.label} 조건 해제`} selected={false} className="course-quick-filters__applied"
              onClick={() => applyFilters(removeCourseFilter(filters, chip.key))} />)}
          </div>
          {selectedCourse ? <>
            <CourseCarousel key={courses.map(course => course.id).join(",")} courses={courses} selectedId={selectedCourse.id}
              savedIds={savedIds} onSelect={discovery.setSelectedId} onSave={saveCourse} onSchedule={openSchedule} onOpen={openCourse} />
            <PageIndicator count={courses.length} activeIndex={activeIndex} className="course-list-sheet__pages"
              onPageChange={index => discovery.setSelectedId(courses[index].id)} />
          </> : <EmptyState title={allCourses.length ? "조건에 맞는 코스가 없어요." : "아직 등록된 코스가 없어요."}
            showIcon={false} description="" className="course-list-sheet__empty" />}
        </>} />
      <BottomNavigation active="home" onNavigate={navigateTab} className="course-page__nav" />
    </div>
    {discovery.filterOpen && <CourseFilterSheet courses={allCourses} filters={filters} sort={sort}
      onApply={applyDetails} onClose={discovery.closeFilter} />}
    {discovery.toast && !discovery.filterOpen && <Toast key={discovery.toast.id} message={discovery.toast.message} className="course-page__toast" />}
  </main>;
}
