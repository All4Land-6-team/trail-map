import assert from 'node:assert/strict';
import test from 'node:test';
import { homePaths } from '../src/routes/homeRoutes.ts';
import { courseReviewPath, internalReturnPath, spotReviewPath } from '../src/routes/communityRoutes.ts';
import { startHikeSession, getCompletedHikes, getHikeSession, setHikeAlerts, startHikeDescent, finishHikeSession } from '../src/store/hikeSessionStore.ts';
import { initialHikeProgress } from '../src/utils/activeHike.ts';
import { cartCourseDetailPath, courseDetailNavigationSource, courseDetailPath } from '../src/routes/courseDetailRoutes.ts';

test('하단 탭이 실제 캘린더와 커뮤니티 및 담기 화면을 가리킨다', () => {
  assert.equal(homePaths.myHikes, 'hikes/calendar');
  assert.equal(homePaths.saved, 'cart');
  assert.equal(homePaths.community, 'community');
});
test('스팟 상세 연결은 선택한 산과 스팟 및 필터 복귀 주소를 보존한다', () => {
  const returnPath = 'mountains/bukhansan/courses/bukhansan-baegundae?tab=spots&category=photo&spot=baegundae-rock';
  const url = spotReviewPath({ mountainId: 'bukhansan', courseId: 'bukhansan-baegundae', spotId: 'baegundae-rock', returnPath });
  const params = new URLSearchParams(url.split('?')[1]);
  assert.equal(params.get('screen'), 'spotDetail');
  assert.equal(params.get('spot'), 'baegundae-rock');
  assert.equal(internalReturnPath(params.get('returnTo')), returnPath);
  assert.equal(internalReturnPath('https://example.com', 'cart'), 'cart');
  assert.equal(internalReturnPath('//example.com'), '');
});
test('코스 상세의 후기 전체보기는 같은 코스와 이전 코스 상세 주소를 보존한다', () => {
  const returnPath = 'mountains/bukhansan/courses/bukhansan-baegundae?returnTo=hikes/detail%3Fdate%3D2026-10-18';
  const url = courseReviewPath({ mountainId: 'bukhansan', courseId: 'bukhansan-baegundae', returnPath });
  const params = new URLSearchParams(url.split('?')[1]);
  assert.equal(params.get('screen'), 'courseReviewList');
  assert.equal(params.get('mountain'), 'bukhansan');
  assert.equal(params.get('course'), 'bukhansan-baegundae');
  assert.equal(internalReturnPath(params.get('returnTo')), returnPath);
});
test('일정에서 코스 상세 탭을 바꿔도 원래 일정으로 돌아간다', () => {
  const request = { mountainId: 'bukhansan', courseId: 'bukhansan-baegundae' };
  const returnTo = 'hikes/detail?date=2026-10-18';
  for (const tab of ['analysis', 'spots']) {
    const path = courseDetailPath(request, { tab, category: 'photo' }, returnTo);
    assert.equal(new URLSearchParams(path.split('?')[1]).get('returnTo'), returnTo);
  }
});
test('담은 코스 비교표에서 FLOW-04 상세로 이동하고 비교 상태를 복구한다', () => {
  const request = { mountainId: 'bukhansan', courseId: 'sumunbyeok' };
  const returnTo = 'cart/metrics?mountain=bukhansan&selected=daenammun%2Csumunbyeok%2Cbukhansan-bogukmun';
  const path = cartCourseDetailPath(request, returnTo);
  assert.equal(path.split('?')[0], 'mountains/bukhansan/courses/sumunbyeok');
  assert.equal(new URLSearchParams(path.split('?')[1]).get('returnTo'), returnTo);
  assert.equal(courseDetailNavigationSource(returnTo), 'saved');
  const scheduleReturnTo = `mountains/bukhansan/courses/sumunbyeok?returnTo=${encodeURIComponent(returnTo)}`;
  assert.equal(courseDetailNavigationSource(scheduleReturnTo), 'saved');
  assert.equal(courseDetailNavigationSource('hikes/detail?date=2026-10-18'), 'home');
  assert.equal(courseDetailNavigationSource('cartography'), 'home');
});
test('시작-알림 변경-하산-완료가 동일 코스와 완료 시각을 유지한다', () => {
  const schedule = { date: '2026-10-18', startTime: '09:00', courseId: 'dobongsan-sinseondae', mountainName: '도봉산', courseName: '신선대 코스', distanceKm: 5.8 };
  assert.equal(getHikeSession(), null);
  finishHikeSession();
  assert.equal(getHikeSession(), null);
  startHikeSession(schedule, 'dobongsan', false);
  schedule.courseName = '외부 변경';
  assert.equal(getHikeSession().schedule.courseName, '신선대 코스');
  startHikeSession({ ...schedule, courseId: 'another' }, 'bukhansan', true);
  assert.equal(getHikeSession().mountainId, 'dobongsan');
  setHikeAlerts(true);
  startHikeDescent();
  assert.equal(getHikeSession().phase, 'downhill');
  assert.equal(getHikeSession().alertsOn, true);
  finishHikeSession();
  const completed = getHikeSession();
  assert.equal(completed.phase, 'complete');
  assert.ok(completed.finishedAt);
  assert.deepEqual(getCompletedHikes().map(hike => [hike.mountainId, hike.courseId]), [['dobongsan', 'dobongsan-sinseondae']]);
  finishHikeSession();
  assert.equal(getHikeSession(), completed);
  assert.equal(getCompletedHikes().length, 1);
});
test('진행 지도는 선택한 코스의 경로를 쓰고 원본과 실측 거리를 조작하지 않는다', () => {
  const course = { mountainName: '도봉산', courseName: '신선대', route: [[127, 37], [127.1, 37.1]], distanceKm: 5.8, spots: [], sunset: '정보 없음' };
  const ascent = initialHikeProgress(course);
  const descent = initialHikeProgress(course, true);
  assert.deepEqual(ascent.route, course.route);
  assert.deepEqual(descent.route, [...course.route].reverse());
  assert.equal(ascent.traveledKm, 0);
  assert.equal(descent.courseName, '신선대');
  assert.equal(ascent.remainingKm, 5.8);
});
