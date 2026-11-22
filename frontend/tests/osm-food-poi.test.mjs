import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fetchOsmFoodPois, foodPoiLayerIds, foodPoiSources, nearestOsmFoodPois, toOsmFoodPoi } from '../src/components/map/osmFoodPoi.ts';

const feature = (properties = {}, geometry = { type: 'Point', coordinates: [126.98, 37.65] }) => ({
  id: 101,
  properties: { name: '산아래 식당', class: 'restaurant', ...properties },
  geometry,
});

test('Liberty 스타일의 OSM POI 심벌 레이어만 클릭 조회 대상으로 선택한다', () => {
  const layers = [
    { id: 'poi_r1', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi' },
    { id: 'poi_r7', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi' },
    { id: 'poi_area', type: 'fill', 'source-layer': 'poi' },
    { id: 'road_label', type: 'symbol', 'source-layer': 'transportation_name' },
  ];
  assert.deepEqual(foodPoiLayerIds(layers), ['poi_r1', 'poi_r7']);
  assert.deepEqual(foodPoiSources(layers), [{ source: 'openmaptiles', sourceLayer: 'poi' }]);
});

test('출발점에서 가까운 OSM 음식점·카페만 중복 제거해 최대 8개를 선택한다', () => {
  const origin = [126.98, 37.65];
  const foods = Array.from({ length: 10 }, (_, index) => feature({ name: `음식점 ${index}` }, {
    type: 'Point', coordinates: [126.98 + index * 0.001, 37.65],
  }));
  foods.forEach((item, index) => { item.id = index; });
  const duplicate = { ...foods[0], properties: { ...foods[0].properties } };
  const nonFood = feature({ name: '화장실', class: 'toilet' });
  const result = nearestOsmFoodPois([...foods.reverse(), duplicate, nonFood], origin, 8);

  assert.equal(result.length, 8);
  assert.deepEqual(result.map(item => item.name), Array.from({ length: 8 }, (_, index) => `음식점 ${index}`));
});

test('낮은 지도 줌에서도 출발점 주변 고해상도 타일 9개에서 음식점 8개를 조회한다', async () => {
  const requested = [];
  const fetcher = async url => {
    requested.push(String(url));
    if (String(url).endsWith('/planet')) {
      return { ok: true, json: async () => ({ tiles: ['https://tiles.example/{z}/{x}/{y}.pbf'] }) };
    }
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  };
  let decoded = 0;
  const decoder = (_buffer, x, y, _z) => {
    const index = decoded++;
    return [{ id: `tile-${x}-${y}`, name: `OSM 음식점 ${index}`, kind: index === 1 ? 'cafe' : 'restaurant',
      coordinate: [126.98 + index * .001, 37.65] }];
  };

  const result = await fetchOsmFoodPois([126.98, 37.65], undefined, fetcher, decoder);

  assert.equal(requested.length, 10);
  assert.equal(requested.filter(url => /\/14\/\d+\/\d+\.pbf$/.test(url)).length, 9);
  assert.equal(decoded, 9);
  assert.equal(result.length, 8);
  assert.equal(result[0].name, 'OSM 음식점 0');
  assert.equal(result.some(item => item.kind === 'cafe'), true);
});

test('OSM 음식점과 카페를 이름·좌표가 있는 선택 정보로 변환한다', () => {
  assert.deepEqual(toOsmFoodPoi(feature(), [127, 37]), {
    id: 'osm-poi-101', name: '산아래 식당', kind: 'restaurant', coordinate: [126.98, 37.65],
  });
  assert.equal(toOsmFoodPoi(feature({ class: 'shop', subclass: 'cafe', name: '능선 카페' }), [127, 37])?.kind, 'cafe');
  assert.equal(toOsmFoodPoi(feature({ class: 'fast_food' }), [127, 37])?.kind, 'restaurant');
});

test('음식점이 아니거나 이름이 없는 POI는 선택하지 않고 좌표가 없으면 클릭 좌표를 사용한다', () => {
  assert.equal(toOsmFoodPoi(feature({ class: 'toilet' }), [127, 37]), null);
  assert.equal(toOsmFoodPoi(feature({ name: '' }), [127, 37]), null);
  assert.deepEqual(toOsmFoodPoi(feature({}, { type: 'Polygon', coordinates: [] }), [127, 37])?.coordinate, [127, 37]);
});

test('음식점 필터는 카카오 API 대신 OSM POI 클릭을 활성화한다', () => {
  const listMap = readFileSync(new URL('../src/pages/CourseListPage/components/CourseMap.tsx', import.meta.url), 'utf8');
  const listPage = readFileSync(new URL('../src/pages/CourseListPage/CourseListPage.tsx', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../src/pages/CourseDetailPage/CourseDetailPage.tsx', import.meta.url), 'utf8');
  const routeMap = readFileSync(new URL('../src/components/map/CourseRouteMap.tsx', import.meta.url), 'utf8');
  assert.match(listMap, /\["food", "음식점"\]/);
  assert.doesNotMatch(listMap, /useCourseNearbyPlaces|nearbySpots/);
  assert.match(listMap, /osmFoodEnabled/);
  assert.doesNotMatch(detail, /useCourseNearbyPlaces|nearby\.state/);
  assert.match(detail, /onOsmFoodSelect/);
  assert.match(listMap, /selectedOsmFood=/);
  assert.match(detail, /selectedOsmFood=/);
  assert.match(routeMap, /course-map__osm-food-marker/);
  assert.match(routeMap, /nearestOsmFoodPois\(features, origin, 8\)/);
  assert.match(listMap, /onOsmFoodOpen\?\.\(poi\)/);
  assert.doesNotMatch(listMap, /props\.onNotify\(`\$\{poi\.name\}/);
  assert.doesNotMatch(listMap, /지도 음식점 아이콘을 눌러보세요/);
  assert.match(listPage, /courseFoodDetailPath/);
});
