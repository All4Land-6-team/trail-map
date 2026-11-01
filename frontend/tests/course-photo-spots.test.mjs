import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCoursePhotoSpots } from '../src/api/coursePhotoSpots.ts';
import { spotReviewPath } from '../src/routes/communityRoutes.ts';
import { communitySpotKey, communitySpotTargetId, resolveSpotSelection } from '../src/utils/communitySpotIdentity.ts';
import { courseSpotAction } from '../src/utils/courseProfile.ts';
import { createServer } from 'vite';
import { coursePhotoSpotDisplay } from '../src/utils/coursePhotoSpotDisplay.ts';

const mountain = { mountainId: 7, externalId: 'bukhansan' };
const course = { courseId: 23, mountainId: 7, externalId: 'baegundae' };
const spot = { targetType: 'USER_SPOT', targetId: 8, mountainId: 7, type: 'PHOTO_SPOT', name: '전망 바위',
  longitude: 127, latitude: 37, photoCount: 2, reviewCount: 1, status: 'PENDING' };

test('사진 스팟은 먼저 지도에 초점을 맞추고 같은 스팟을 다시 선택해야 상세를 연다', () => {
  const first = { id: 'USER_SPOT:8', kind: 'photo', communityTarget: { targetId: '8' } };
  const second = { id: 'USER_SPOT:9', kind: 'photo', communityTarget: { targetId: '9' } };
  assert.equal(courseSpotAction(first), 'focus');
  assert.equal(courseSpotAction(first, first.id), 'open');
  assert.equal(courseSpotAction(second, first.id), 'focus');
  assert.equal(courseSpotAction(second, second.id), 'open');
  assert.equal(courseSpotAction({ id: 'facility-1', facilityId: 1 }, 'facility-1'), 'focus');
  assert.equal(courseSpotAction({ id: 'example-photo', kind: 'photo', example: true }, 'example-photo'), 'unavailable');
});

test('산·코스 외부 ID를 실제 코스 ID로 매핑해 사진 스팟을 조회한다', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    return Response.json({ data: calls.length === 1 ? [mountain] : calls.length === 2 ? [course] : [spot] });
  };
  try {
    const spots = await loadCoursePhotoSpots({ mountainId: 'bukhansan', courseId: 'baegundae' }, new AbortController().signal);
    assert.ok(calls[2].endsWith('/courses/23/photo-spots'));
    assert.equal(spots[0].id, 'USER_SPOT:8');
    assert.deepEqual(spots[0].coordinate, [127, 37]);
    assert.deepEqual(spots[0].communityTarget, { mountainId: '7', targetType: 'USER_SPOT', targetId: '8' });
  } finally { globalThis.fetch = original; }
});

test('미연결 코스·다른 산 응답·조회 오류를 실제 빈 결과와 구분한다', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => Response.json({ data: String(url).endsWith('/mountains') ? [mountain] : [] });
    assert.equal(await loadCoursePhotoSpots({ mountainId: 'bukhansan', courseId: 'missing' }, new AbortController().signal), null);
    globalThis.fetch = async url => Response.json({ data: String(url).endsWith('/mountains') ? [mountain]
      : String(url).endsWith('/courses') ? [course] : [{ ...spot, mountainId: 9 }] });
    await assert.rejects(loadCoursePhotoSpots({ mountainId: '7', courseId: '23' }, new AbortController().signal), /응답이 올바르지/);
    globalThis.fetch = async () => Response.json({ message: '조회 실패' }, { status: 503 });
    await assert.rejects(loadCoursePhotoSpots({ mountainId: '7', courseId: '23' }, new AbortController().signal), /조회 실패/);
  } finally { globalThis.fetch = original; }
});

test('실제 경로 화면의 DB 코스 ID로 사진 스팟을 직접 조회한다', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.ok(String(url).endsWith('/courses/23/photo-spots'));
    return Response.json({ data: [spot] });
  };
  try {
    const result = await loadCoursePhotoSpots({ mountainId: 'bukhansan', courseId: 'db-23' }, new AbortController().signal, 7);
    assert.equal(result[0].communityTarget.targetId, '8');
  } finally { globalThis.fetch = original; }
});

test('같은 산에서 코스를 전환하면 해당 DB 코스 ID로 조회하고 빈 결과를 유지한다', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    const path = String(url);
    calls.push(path);
    return Response.json({ data: path.endsWith('/mountains') ? [mountain]
      : path.endsWith('/courses') ? [course, { ...course, courseId: 24, externalId: 'other' }]
      : path.endsWith('/courses/23/photo-spots') ? [spot] : [] });
  };
  try {
    const first = await loadCoursePhotoSpots({ mountainId: 'bukhansan', courseId: 'baegundae' }, new AbortController().signal);
    const second = await loadCoursePhotoSpots({ mountainId: 'bukhansan', courseId: 'other' }, new AbortController().signal);
    assert.equal(first[0].id, 'USER_SPOT:8');
    assert.deepEqual(second, []);
    assert.ok(calls.at(-1).endsWith('/courses/24/photo-spots'));
  } finally { globalThis.fetch = original; }
});

test('실제 조회의 빈 결과·로딩·오류·미연결을 보존하고 명시적 예시 모드에서만 mock을 표시한다', () => {
  const examples = [{ id: 'example', kind: 'photo', example: true }];
  for (const state of [{ status: 'success', spots: [] }, { status: 'loading' },
    { status: 'error', message: '실패' }, { status: 'unavailable' }]) {
    assert.deepEqual(coursePhotoSpotDisplay(state, examples, false), state);
  }
  assert.deepEqual(coursePhotoSpotDisplay({ status: 'loading' }, examples, true), { status: 'success', spots: examples });
});

test('상세 이동은 실제 대상 종류·ID와 복귀 시 선택한 마커를 보존한다', () => {
  const returnPath = 'mountains/bukhansan/courses/baegundae?tab=spots&category=photo&spot=USER_SPOT%3A8';
  const path = spotReviewPath({ mountainId: '7', courseId: 'baegundae', spotId: '8', targetType: 'USER_SPOT', category: 'photo', returnPath });
  const query = new URLSearchParams(path.split('?')[1]);
  assert.equal(query.get('spot'), '8');
  assert.equal(query.get('targetType'), 'USER_SPOT');
  assert.equal(query.get('returnTo'), returnPath);
  const spots = ['FACILITY', 'USER_SPOT'].map(targetType => ({ id: communitySpotKey(targetType, 8), targetType }));
  assert.equal(resolveSpotSelection(spots, 'USER_SPOT:8', 'USER_SPOT:8'), 'USER_SPOT:8');
  assert.equal(resolveSpotSelection(spots, 'USER_SPOT:9', 'USER_SPOT:9'), 'USER_SPOT:9');
  assert.equal(resolveSpotSelection(spots, '8', '8'), '8'); // ambiguous legacy URL
  assert.equal(communitySpotTargetId(spots[1]), '8');
});

test('개발 화면의 예시 2개를 보존하고 로컬 적재 외부 ID로 코스를 추정하지 않는다', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' });
  const original = globalThis.fetch;
  try {
    const { loadCourseDetailData } = await server.ssrLoadModule('/src/api/courseDetailMock.ts');
    const mock = await loadCourseDetailData({ mountainId: 'bukhansan', courseId: 'bukhansan-baegundae' }, new AbortController().signal);
    assert.deepEqual(mock.spots.map(spot => spot.name), ['사진 스팟 1', '사진 스팟 2']);
    assert.deepEqual(mock.spots.map(spot => spot.coordinate), [
      [126.98327484333367, 37.66024580722228], [126.97951067286327, 37.65935713011177],
    ]);
    const { loadCoursePhotoSpots: loadDevelopmentSpots } = await server.ssrLoadModule('/src/api/coursePhotoSpots.ts');
    // 개발 서버에서도 로컬 적재 외부 ID를 특정 화면 코스에 고정 연결하지 않는다.
    const calls = [];
    globalThis.fetch = async url => {
      calls.push(String(url));
      return Response.json({ data: [{ mountainId: 2, externalId: 'L999M001S009;buffer-inset-3000m' }] });
    };
    assert.equal(await loadDevelopmentSpots({ mountainId: 'bukhansan', courseId: 'bukhansan-baegundae' }, new AbortController().signal), null);
    assert.equal(calls.length, 1);
  } finally { globalThis.fetch = original; await server.close(); }
});
