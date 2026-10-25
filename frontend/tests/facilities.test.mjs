import assert from 'node:assert/strict';
import test from 'node:test';
import { facilityReviewUrl, filterFacilities, groupFacilityLocations, loadFacilityReview, parseFacilityReview } from '../src/api/facilities.ts';

function feature(id = 7, name = '도봉산입구화장실', recordId = '323') {
  return {
    type: 'Feature', id, geometry: { type: 'Point', coordinates: [127.04, 37.68] },
    properties: {
      facilityId: id, mountainId: null, name, type: 'RESTROOM', longitude: 127.04, latitude: 37.68,
      sourceReportedStatus: 'USE_YN=1', sourceRecordId: recordId, sourceDate: '2014-12-19',
      importedAt: '2026-10-25T02:35:48+09:00', distanceMeters: null,
      source: { sourceId: 4, name: '국립공원 화장실', provider: '국립공원공단', url: null,
        format: 'SHP', crs: 'EPSG:4326', version: '20141219' },
    },
  };
}
function collection(features = [feature()]) { return { type: 'FeatureCollection', features }; }

test('실제 GeoJSON 계약과 빈 목록을 허용하고 다른 출처·잘못된 좌표는 거부한다', () => {
  assert.equal(parseFacilityReview(collection(), 4).features.length, 1);
  assert.equal(parseFacilityReview(collection([]), 4).features.length, 0);
  assert.throws(() => parseFacilityReview(collection(), 5));
  for (const coordinate of [[37.68, 127.04], [NaN, 37.68], [181, 37.68], [127, 37, 1]]) {
    const item = feature();
    item.geometry.coordinates = coordinate;
    assert.throws(() => parseFacilityReview(collection([item]), 4));
  }
  const wrongProperty = feature();
  wrongProperty.properties.latitude = 38;
  assert.throws(() => parseFacilityReview(collection([wrongProperty]), 4));
});

test('같은 시설 ID는 거부하지만 같은 좌표의 서로 다른 시설은 보존한다', () => {
  assert.throws(() => parseFacilityReview(collection([feature(), feature()]), 4));
  const result = parseFacilityReview(collection([feature(), feature(8, '다른 화장실', '324')]), 4);
  const groups = groupFacilityLocations(result.features.map(item => item.properties));
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].map(item => item.facilityId), [7, 8]);
});

test('원본 ID 문자열과 한글 이름으로 검색하고 검색 해제 시 전체를 반환한다', () => {
  const records = [feature().properties, feature(8, '백운대화장실', '00324').properties, feature(9, null, null).properties];
  assert.deepEqual(filterFacilities(records, ' 도봉 ').map(item => item.facilityId), [7]);
  assert.deepEqual(filterFacilities(records, '00324').map(item => item.facilityId), [8]);
  assert.equal(filterFacilities(records, '없는시설').length, 0);
  assert.equal(filterFacilities(records, '  ').length, 3);
});

test('조회 URL은 명시한 출처와 RESTROOM 필터를 사용하며 잘못된 출처를 거부한다', () => {
  assert.equal(facilityReviewUrl(4, 'http://localhost:8080/'), 'http://localhost:8080/api/v1/facilities/review?sourceId=4&type=RESTROOM');
  for (const id of [0, -1, NaN, 1.2, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => facilityReviewUrl(id));
});

test('GET 응답을 검증하고 404·서버 오류·연결 실패·시간 초과를 안내한다', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Accept, 'application/geo+json');
    return new Response(JSON.stringify(collection()));
  };
  assert.equal((await loadFacilityReview(4)).features.length, 1);
  globalThis.fetch = async () => new Response('', { status: 404 });
  await assert.rejects(loadFacilityReview(4), /sourceId/);
  globalThis.fetch = async () => new Response('', { status: 500 });
  await assert.rejects(loadFacilityReview(4), /HTTP 500/);
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(loadFacilityReview(4), /연결할 수 없습니다/);
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
  await assert.rejects(loadFacilityReview(4, { timeoutMs: 1 }), /시간이 초과/);
  const controller = new AbortController();
  const request = loadFacilityReview(4, { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, error => error.name === 'AbortError');
});
