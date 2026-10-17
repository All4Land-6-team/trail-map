import assert from 'node:assert/strict';
import test from 'node:test';
import { changeCourseDistance, DEFAULT_COURSE_FILTERS, getCourseFilterChips, hasCourseFilters, removeCourseFilter, selectCourses } from '../src/utils/courseDiscovery.ts';
import { coursePaths, readCourseRoute } from '../src/routes/courseRoutes.ts';
import { getSavedCourseIds, setCourseSaved, subscribeSavedCourses } from '../src/store/courseSelectionStore.ts';

const base = { difficulty: 'beginner', distanceKm: 4, durationMinutes: 120, steepRatioPercent: 10 };
const course = (id, extra = {}) => ({ ...base, id, name: id, ...extra });
const filter = extra => ({ ...DEFAULT_COURSE_FILTERS, ...extra });

test('2시간 경계는 2시간 이내와 2~4시간에 포함하고 4시간 초과는 제외한다', () => {
  const courses = [course('119', { durationMinutes: 119 }), course('120'), course('240', { durationMinutes: 240 }), course('241', { durationMinutes: 241 })];
  assert.deepEqual(selectCourses(courses, filter({ duration: 'under2' }), 'name').map(c => c.id), ['119', '120']);
  assert.deepEqual(selectCourses(courses, filter({ duration: '2to4' }), 'name').map(c => c.id), ['120', '240']);
});
test('거리 필터의 양 끝을 포함하고 초기 전체 상태는 장거리 코스도 표시한다', () => {
  const courses = [course('short', { distanceKm: 0.4 }), course('min', { distanceKm: 0.5 }), course('max', { distanceKm: 6 }), course('long', { distanceKm: 12 })];
  assert.equal(selectCourses(courses, filter({}), 'name').length, 4);
  assert.deepEqual(selectCourses(courses, filter({ minDistanceKm: 0.5, maxDistanceKm: 6 }), 'name').map(c => c.id), ['max', 'min']);
});
test('급경사 조건은 경계값을 포함하고 미분석 값을 안전한 수치로 간주하지 않는다', () => {
  const courses = [course('known'), course('unknown', { steepRatioPercent: null }), course('over', { steepRatioPercent: 20.1 }), course('edge', { steepRatioPercent: 20 })];
  assert.deepEqual(selectCourses(courses, filter({ steepRatio: '20' }), 'name').map(c => c.id), ['edge', 'known']);
  assert.deepEqual(selectCourses(courses, filter({ steepRatio: '10' }), 'name').map(c => c.id), ['known']);
});
test('난이도 순서·같은 난이도의 이름순·정보 없는 코스의 마지막 순서를 지킨다', () => {
  const courses = [course('unknown', { name: '가 코스', difficulty: null }), course('advanced', { difficulty: 'advanced' }), course('b', { name: '나 코스' }), course('a', { name: '가 코스' }), course('middle', { difficulty: 'intermediate' })];
  assert.deepEqual(selectCourses(courses, filter({}), 'difficulty').map(c => c.id), ['a', 'b', 'middle', 'advanced', 'unknown']);
  assert.deepEqual(selectCourses(courses, filter({ difficulty: 'beginner' }), 'name').map(c => c.id), ['a', 'b']);
  assert.equal(courses[0].id, 'unknown');
});
test('거리 손잡이를 교차해도 0.5km 간격과 범위를 유지한다', () => {
  const range = filter({ minDistanceKm: 1, maxDistanceKm: 2 });
  assert.equal(changeCourseDistance(range, 'min', 8).minDistanceKm, 1.5);
  assert.equal(changeCourseDistance(range, 'max', 0).maxDistanceKm, 1.5);
  assert.equal(changeCourseDistance(range, 'min', -100).minDistanceKm, 0);
  assert.equal(changeCourseDistance(range, 'max', 100).maxDistanceKm, 10);
  assert.equal(changeCourseDistance(range, 'min', 0.7).minDistanceKm, 0.5);
});
test('적용 Chip 해제는 해당 조건만 초기화하며 전체 초기화는 모든 조건을 제거한다', () => {
  const applied = filter({ difficulty: 'intermediate', duration: '2to4', minDistanceKm: 0.5, maxDistanceKm: 6, steepRatio: '20' });
  assert.deepEqual(getCourseFilterChips(applied).map(c => c.key), ['duration', 'distance', 'steepRatio']);
  const removed = removeCourseFilter(applied, 'distance');
  assert.equal(removed.minDistanceKm, 0);
  assert.equal(removed.maxDistanceKm, 10);
  assert.equal(removed.duration, '2to4');
  assert.equal(removed.difficulty, 'intermediate');
  assert.equal(hasCourseFilters(applied), true);
  assert.equal(hasCourseFilters(DEFAULT_COURSE_FILTERS), false);
});
test('화면 이동 경로는 산·코스 ID를 보존하고 잘못된 URL 인코딩은 거부한다', () => {
  const request = { mountainId: '산/1', courseId: '코스 2' };
  assert.equal(readCourseRoute('#' + coursePaths.list(request.mountainId)).mountainId, request.mountainId);
  assert.deepEqual(readCourseRoute('#' + coursePaths.detail(request)), { ...request, destination: 'detail' });
  assert.deepEqual(readCourseRoute('#' + coursePaths.schedule(request)), { ...request, destination: 'schedule' });
  assert.equal(readCourseRoute('#mountains/%broken/courses'), null);
  assert.equal(readCourseRoute('#hikes/calendar'), null);
  assert.equal(readCourseRoute('#mountains/a/courses/b/unexpected'), null);
});
test('담기 저장소는 화면 간 동일 스냅샷을 공유하고 중복 담기와 구독 해제를 처리한다', () => {
  let changes = 0;
  const unsubscribe = subscribeSavedCourses(() => changes++);
  setCourseSaved('test-course', true);
  const snapshot = getSavedCourseIds();
  setCourseSaved('test-course', true);
  assert.equal(getSavedCourseIds(), snapshot);
  assert.equal(changes, 1);
  assert.equal(snapshot.includes('test-course'), true);
  setCourseSaved('test-course', false);
  assert.equal(getSavedCourseIds().includes('test-course'), false);
  assert.equal(snapshot.includes('test-course'), true);
  unsubscribe();
  setCourseSaved('second-test-course', true);
  assert.equal(changes, 2);
  setCourseSaved('second-test-course', false);
});
