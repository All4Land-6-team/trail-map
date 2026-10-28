import assert from 'node:assert/strict';
import test from 'node:test';
import { courseFacilitiesUrl, loadCourseFacilities, parseCourseFacilities } from '../src/api/courseFacilities.ts';
import { toCourseFacilitySpots, withCourseFacilities } from '../src/utils/courseFacilities.ts';

test('음수대 필터와 실제 좌표를 사용하고 mock 음수대는 오류·빈 결과에도 제외한다', async (t) => {
  const water = { ...facility(80, 120), type: 'DRINKING_WATER', name: '시험 샘터', sourceDate: '2024-05-22' };
  assert.equal(courseFacilitiesUrl(2, 250, 'http://localhost:8080', 'DRINKING_WATER'),
    'http://localhost:8080/api/v1/courses/2/facilities?type=DRINKING_WATER&radiusMeters=250');
  const parsed = parseCourseFacilities(response([water]), 250, 'DRINKING_WATER');
  assert.throws(() => parseCourseFacilities(response([facility()]), 250, 'DRINKING_WATER'));
  const spots = toCourseFacilitySpots(parsed, 'course');
  assert.equal(spots[0].kind, 'water');
  assert.deepEqual(spots[0].coordinate, [water.longitude, water.latitude]);
  assert.equal(spots[0].name, '시험 샘터');
  const mock = [{ id: 'mock-water', kind: 'water' }, { id: 'mock-restroom', kind: 'restroom' }, { id: 'photo', kind: 'photo' }];
  assert.deepEqual(withCourseFacilities(mock, []).map(item => item.id), ['photo']);
  assert.deepEqual(withCourseFacilities(mock, spots).map(item => item.id), ['photo', 'facility-80']);
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url) => {
    assert.match(url, /type=DRINKING_WATER/);
    return new Response(JSON.stringify(response([water])));
  };
  assert.equal((await loadCourseFacilities(2, { type: 'DRINKING_WATER' }))[0].type, 'DRINKING_WATER');
  globalThis.fetch = async () => new Response('', { status: 500 });
  await assert.rejects(loadCourseFacilities(2, { type: 'DRINKING_WATER' }), /음수대를 불러오지 못/);
});

const facility = (facilityId = 52, distanceMeters = 69.6) => ({
  facilityId, name: '간이화장실', type: 'RESTROOM', longitude: 126.9846, latitude: 37.6599,
  distanceMeters, sourceDate: '2014-12-19',
});
const response = (data = [facility()]) => ({ success: true, data });

test('쉼터는 별도 유형으로 조회하고 원본 ID·좌표를 보존하며 mock 시설 전체를 제외한다', async (t) => {
  const shelter = { ...facility(101, 85), type: 'SHELTER', name: '시험 파고라', sourceDate: '2024-09-11' };
  assert.match(courseFacilitiesUrl(2, 250, 'http://localhost:8080', 'SHELTER'), /type=SHELTER/);
  const spots = toCourseFacilitySpots(parseCourseFacilities(response([shelter]), 250, 'SHELTER'), 'course');
  assert.equal(spots[0].kind, 'shelter');
  assert.equal(spots[0].id, 'facility-101');
  assert.deepEqual(spots[0].coordinate, [shelter.longitude, shelter.latitude]);
  const mock = ['water', 'shelter', 'restroom', 'photo'].map(kind => ({ id: kind, kind }));
  assert.deepEqual(withCourseFacilities(mock, []).map(item => item.kind), ['photo']);
  assert.deepEqual(withCourseFacilities(mock, spots).map(item => item.id), ['photo', 'facility-101']);
  assert.throws(() => parseCourseFacilities(response([shelter]), 250, 'DRINKING_WATER'));
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async url => {
    assert.match(url, /type=SHELTER/);
    return new Response(JSON.stringify(response([shelter])));
  };
  assert.equal((await loadCourseFacilities(2, { type: 'SHELTER' }))[0].type, 'SHELTER');
  globalThis.fetch = async () => new Response('', { status: 500 });
  await assert.rejects(loadCourseFacilities(2, { type: 'SHELTER' }), /쉼터를 불러오지 못/);
});

test('코스 주변 API 계약: 빈 결과·좌표 중복을 보존하고 거리순으로 반환한다', () => {
  assert.deepEqual(parseCourseFacilities(response([])), []);
  const items = parseCourseFacilities(response([facility(51, 125.8), facility()]));
  assert.deepEqual(items.map(item => item.facilityId), [52, 51]);
  assert.deepEqual(items.map(item => [item.longitude, item.latitude]), [[126.9846, 37.6599], [126.9846, 37.6599]]);
  assert.throws(() => parseCourseFacilities(response([facility(), facility()])));
  for (const value of [{ success: false, data: [] }, { type: 'FeatureCollection', features: [] }, { success: true, data: null }]) {
    assert.throws(() => parseCourseFacilities(value));
  }
  for (const change of [{ latitude: 127 }, { longitude: NaN }, { distanceMeters: null },
    { distanceMeters: -1 }, { distanceMeters: 251 }, { type: 'SHELTER' }, { facilityId: 0 }, { sourceDate: 'yesterday' }]) {
    assert.throws(() => parseCourseFacilities(response([{ ...facility(), ...change }])));
  }
});

test('시설 ID와 실제 좌표로 스팟을 만들고, 합성 화장실은 빈 결과에서도 제외한다', () => {
  const spots = toCourseFacilitySpots([facility(), { ...facility(51), name: null }], 'bukhansan-baegundae');
  assert.equal(spots[0].id, 'facility-52');
  assert.deepEqual(spots[0].coordinate, [126.9846, 37.6599]);
  assert.equal(spots[0].distanceMeters, 69.6);
  assert.equal(spots[1].name, '화장실 51');
  const mock = [{ id: 'mock-toilet', kind: 'restroom' }, { id: 'photo', kind: 'photo' }];
  assert.deepEqual(withCourseFacilities(mock, spots).map(item => item.id), ['photo', 'facility-52', 'facility-51']);
  assert.deepEqual(withCourseFacilities(mock, []).map(item => item.id), ['photo']);
  assert.equal(mock.length, 2);
});

test('코스 ID·유형·250m 조건으로 요청하고 잘못된 ID와 거리 요청은 차단한다', () => {
  assert.equal(courseFacilitiesUrl(2, 250, 'http://localhost:8080/'),
    'http://localhost:8080/api/v1/courses/2/facilities?type=RESTROOM&radiusMeters=250');
  for (const id of [0, -1, 1.5, NaN]) assert.throws(() => courseFacilitiesUrl(id));
  for (const radius of [0, -1, 5001, Infinity, NaN]) assert.throws(() => courseFacilitiesUrl(2, radius));
});

test('실제 API 형태를 읽고 실패·잘못된 JSON·시간 초과·화면 이탈을 구분한다', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    assert.match(url, /\/courses\/2\/facilities\?type=RESTROOM&radiusMeters=250$/);
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.cache, 'no-store');
    return new Response(JSON.stringify(response()));
  };
  assert.equal((await loadCourseFacilities(2))[0].facilityId, 52);
  globalThis.fetch = async () => new Response(JSON.stringify(response([])));
  assert.deepEqual(await loadCourseFacilities(2), []);
  globalThis.fetch = async () => new Response('', { status: 404 });
  await assert.rejects(loadCourseFacilities(2), /코스를 찾을 수/);
  globalThis.fetch = async () => new Response('', { status: 500 });
  await assert.rejects(loadCourseFacilities(2), /불러오지 못/);
  globalThis.fetch = async () => new Response('not-json');
  await assert.rejects(loadCourseFacilities(2), /응답 형식/);
  globalThis.fetch = async () => { throw new TypeError('network'); };
  await assert.rejects(loadCourseFacilities(2), /연결할 수/);
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
  await assert.rejects(loadCourseFacilities(2, { timeoutMs: 1 }), /응답이 늦어/);
  const controller = new AbortController();
  const pending = loadCourseFacilities(2, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  globalThis.fetch = () => { assert.fail('취소된 화면에서는 요청하지 않아야 한다'); };
  await assert.rejects(loadCourseFacilities(2, { signal: controller.signal }), error => error.name === 'AbortError');
});
