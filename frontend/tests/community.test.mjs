import assert from 'node:assert/strict';
import test from 'node:test';
import { DUPLICATE_RADIUS_METERS, REVIEW_WINDOW_MS, SEGMENT_STATUS_CONFIRMATION_COUNT, SPOT_HIDE_NEGATIVE_VOTES, canWriteReview, castSpotVote, distanceMeters, isSpotHidden, nearbySpotCandidates, resolveSegmentStatus } from '../src/utils/community.ts';

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
  const hike = (ago) => ({ mountainId: 'bukhansan', finishedAt: new Date(now - ago).toISOString() });
  assert.equal(canWriteReview(hike(REVIEW_WINDOW_MS), 'bukhansan', now), true);
  assert.equal(canWriteReview(hike(REVIEW_WINDOW_MS + 1), 'bukhansan', now), false);
  assert.equal(canWriteReview(hike(1000), 'dobongsan', now), false);
  assert.equal(canWriteReview({ mountainId: 'bukhansan', finishedAt: new Date(now + 1000).toISOString() }, 'bukhansan', now), false);
  assert.equal(canWriteReview(undefined, 'bukhansan', now), false);
});

test('구간 상태는 최신 연속 동일 상태 5건부터 바뀌고 그전에는 직전 확정 상태를 유지한다', () => {
  const review = (status, index) => ({ id: String(index), kind: 'segment', targetId: 'ascent', status,
    content: '', photos: [], createdAt: new Date(1_000_000 + index * 1000).toISOString() });
  assert.equal(SEGMENT_STATUS_CONFIRMATION_COUNT, 5);
  assert.equal(resolveSegmentStatus([]), 'caution');
  const goodFive = Array.from({ length: 5 }, (_, index) => review('good', index));
  assert.equal(resolveSegmentStatus(goodFive.slice(0, 4)), 'caution');
  assert.equal(resolveSegmentStatus(goodFive), 'good');
  const dangerFour = Array.from({ length: 4 }, (_, index) => review('danger', index + 5));
  assert.equal(resolveSegmentStatus([...goodFive, ...dangerFour]), 'good');
  assert.equal(resolveSegmentStatus([...goodFive, ...dangerFour, review('danger', 9)]), 'danger');
  assert.equal(resolveSegmentStatus([...goodFive, ...dangerFour, review('caution', 9), review('danger', 10)]), 'good');
});
