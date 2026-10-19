import assert from 'node:assert/strict';
import test from 'node:test';
import { DUPLICATE_RADIUS_METERS, REVIEW_WINDOW_MS, SPOT_HIDE_NEGATIVE_VOTES, canWriteCourseReview, canWriteReview, castSpotVote, distanceMeters, eligibleCourseCompletions, isSpotHidden, nearbySpotCandidates } from '../src/utils/community.ts';
import { communityMarkerMode } from '../src/pages/CommunityPage/components/communityMapZoom.ts';

test('커뮤니티 지도 줌 단계는 기본점, 숫자 클러스터, 개별 아이콘 순으로 전환한다', () => {
  assert.equal(communityMarkerMode(9.5), 'overview');
  assert.equal(communityMarkerMode(12), 'overview');
  assert.equal(communityMarkerMode(12.99), 'overview');
  assert.equal(communityMarkerMode(13), 'cluster');
  assert.equal(communityMarkerMode(14), 'cluster');
  assert.equal(communityMarkerMode(15.99), 'cluster');
  assert.equal(communityMarkerMode(16), 'individual');
});

const base = [126.978, 37.659];
const near = [base[0] + 0.00015, base[1]];
const far = [base[0] + 0.001, base[1]];
const spot = (id, type, coordinate) => ({ id, type, coordinate });

test('같은 유형·30m 이내 스팟만 중복 후보이며 거리순으로 표시한다', () => {
  assert.equal(DUPLICATE_RADIUS_METERS, 30);
  assert.ok(distanceMeters(base, near) < 30);
  assert.ok(distanceMeters(base, far) > 30);
  const spots = [spot('far', 'shelter', far), spot('other-type', 'photo', base), spot('near', 'shelter', near), spot('exact', 'shelter', base)];
  const result = nearbySpotCandidates(spots, base, 'shelter', {});
  assert.deepEqual(result.map(item => item.spot.id), ['exact', 'near']);
  assert.equal(result[0].meters, 0);
});

test('부정 평가 3건부터 스팟을 숨기고 후보 조회에서도 제외한다', () => {
  assert.equal(SPOT_HIDE_NEGATIVE_VOTES, 3);
  const before = { yes: 1, no: 2, viewer: null };
  assert.equal(isSpotHidden(before), false);
  const after = castSpotVote(before, 'no');
  assert.equal(after.no, 3);
  assert.equal(isSpotHidden(after), true);
  assert.deepEqual(nearbySpotCandidates([spot('hidden', 'shelter', base)], base, 'shelter', { hidden: after }), []);
});

test('한 사용자의 평가 변경과 같은 버튼 재선택에 의한 취소를 반영한다', () => {
  const first = castSpotVote({ yes: 2, no: 1, viewer: null }, 'yes');
  assert.deepEqual(first, { yes: 3, no: 1, viewer: 'yes' });
  assert.deepEqual(castSpotVote(first, 'yes'), { yes: 2, no: 1, viewer: null });
  assert.deepEqual(castSpotVote(first, 'no'), { yes: 2, no: 2, viewer: 'no' });
});

test('완료한 산행 후 24시간 이내에만 그 산의 후기를 작성할 수 있다', () => {
  const now = Date.parse('2026-10-18T12:00:00+09:00');
  const hike = (id, courseId, ago, mountainId = 'bukhansan') => ({ id, courseId, mountainId, courseName: courseId, distanceKm: 4.2, finishedAt: new Date(now - ago).toISOString() });
  assert.equal(canWriteReview([hike('limit', 'course-a', REVIEW_WINDOW_MS)], 'bukhansan', now), true);
  assert.equal(canWriteReview([hike('expired', 'course-a', REVIEW_WINDOW_MS + 1)], 'bukhansan', now), false);
  assert.equal(canWriteReview([hike('other', 'course-a', 1000, 'dobongsan')], 'bukhansan', now), false);
  assert.equal(canWriteReview([{ ...hike('future', 'course-a', 0), finishedAt: new Date(now + 1000).toISOString() }], 'bukhansan', now), false);
  assert.equal(canWriteReview([], 'bukhansan', now), false);
});

test('24시간 이내 완료 코스는 최신순으로 표시하고 같은 코스는 최신 기록만 남긴다', () => {
  const now = Date.parse('2026-10-18T12:00:00+09:00');
  const hike = (id, courseId, hours) => ({ id, courseId, mountainId: 'bukhansan', courseName: courseId, distanceKm: 4.2,
    finishedAt: new Date(now - hours * 60 * 60 * 1000).toISOString() });
  const eligible = eligibleCourseCompletions([
    hike('a-old', 'course-a', 8), hike('b', 'course-b', 2), hike('a-new', 'course-a', 1), hike('expired', 'course-c', 25),
  ], 'bukhansan', now);
  assert.deepEqual(eligible.map(item => item.id), ['a-new', 'b']);
  assert.equal(canWriteCourseReview(eligible, 'bukhansan', 'course-a', 'a-new', now), true);
  assert.equal(canWriteCourseReview(eligible, 'bukhansan', 'course-b', 'a-new', now), false);
  assert.equal(canWriteCourseReview(eligible, 'bukhansan', 'course-a', 'a-old', now), false);
});
