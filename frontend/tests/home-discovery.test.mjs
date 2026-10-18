import assert from 'node:assert/strict';
import test from 'node:test';
import { addRecentMountain, findMountainByQuery, findTodaySchedule, normalizeMountainQuery, readRecentMountainIds, toHomeDateKey } from '../src/utils/homeDiscovery.ts';
import { homePaths } from '../src/routes/homeRoutes.ts';

const mountains = [
  { id: 'bukhansan', name: '북한산', position: [126.977, 37.659] },
  { id: 'dobongsan', name: '도봉산', position: [127.034, 37.696] },
];
const allowedIds = new Set(mountains.map((mountain) => mountain.id));

test('한글 조합형과 공백을 정규화하고 정확한 이름·부분 이름을 찾는다', () => {
  assert.equal(normalizeMountainQuery('  북 한 산  '.normalize('NFD')), '북한산');
  assert.equal(findMountainByQuery(mountains, '도봉')?.id, 'dobongsan');
  assert.equal(findMountainByQuery(mountains, ' 북한산 ')?.id, 'bukhansan');
  assert.equal(findMountainByQuery(mountains, '없는산'), undefined);
  assert.equal(findMountainByQuery(mountains, '  '), undefined);
  const overlapping = [{ ...mountains[0], id: 'small', name: '작은북한산' }, mountains[0]];
  assert.equal(findMountainByQuery(overlapping, '북한산')?.id, 'bukhansan');
});

test('손상된 저장값은 복구하고 알 수 없는 ID·중복 ID는 제외한다', () => {
  assert.deepEqual(readRecentMountainIds('{broken', allowedIds, ['bukhansan'], 5), ['bukhansan']);
  assert.deepEqual(readRecentMountainIds('{"not":"array"}', allowedIds, ['bukhansan'], 5), ['bukhansan']);
  assert.deepEqual(readRecentMountainIds('[null,7,"removed","dobongsan","dobongsan","bukhansan"]', allowedIds, [], 5), ['dobongsan', 'bukhansan']);
  assert.deepEqual(readRecentMountainIds('[]', allowedIds, ['bukhansan'], 5), []);
});

test('최근 본 산을 맨 앞으로 이동하고 원본 배열을 유지한다', () => {
  const previous = ['bukhansan', 'dobongsan'];
  assert.deepEqual(addRecentMountain(previous, 'dobongsan', 5), ['dobongsan', 'bukhansan']);
  assert.deepEqual(addRecentMountain(previous, 'new', 2), ['new', 'bukhansan']);
  assert.deepEqual(previous, ['bukhansan', 'dobongsan']);
});

test('한국 날짜의 자정·연도 경계를 기준으로 오늘 일정을 선택한다', () => {
  const today = toHomeDateKey(new Date('2026-12-31T15:01:00Z'), 'Asia/Seoul');
  assert.equal(today, '2027-01-01');
  const base = { courseId: 'bukhansan-baegundae', mountainName: '북한산', courseName: '백운대 코스', startTime: '07:30', phase: 'planned' };
  const schedules = [{ ...base, date: '2026-12-31' }, { ...base, date: today }];
  assert.equal(findTodaySchedule(schedules, today)?.date, today);
  assert.equal(findTodaySchedule(schedules, '2027-01-02'), undefined);
  assert.equal(findTodaySchedule([...schedules, { ...base, date: today, phase: 'active' }], today)?.phase, 'active');
});

test('코스 선택과 일정 상태를 후속 화면의 해시 경로로 전달한다', () => {
  assert.equal(homePaths.community, 'community');
  assert.equal(homePaths.saved, 'cart');
  assert.equal(homePaths.myHikes, 'hikes/calendar');
  assert.equal(homePaths.mountainCourses('bukhansan'), 'mountains/bukhansan/courses');
  assert.equal(homePaths.mountainCourses('산/1'), 'mountains/%EC%82%B0%2F1/courses');
  assert.equal(homePaths.todayHike('planned'), 'hikes/today');
  assert.equal(homePaths.todayHike('active'), 'hikes/active');
});
