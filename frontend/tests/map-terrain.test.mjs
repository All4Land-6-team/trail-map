import assert from "node:assert/strict";
import test from "node:test";
import {
  loadTerrainSource,
  parseTerrainSource,
  terrainSourceUrl,
} from "../src/api/terrain.ts";
import {
  HILLSHADE_LAYER_ID,
  HILLSHADE_SOURCE_ID,
  TERRAIN_SOURCE_ID,
  applyTerrainMode,
  installTerrainLayers,
  isTerrainSourceError,
  removeTerrainLayers,
  supportsTerrain,
} from "../src/components/map/terrain.ts";

const source = {
  type: "raster-dem",
  tiles: ["http://localhost:8080/api/v1/terrain/{z}/{x}/{y}.png"],
  minzoom: 10,
  maxzoom: 16,
  bounds: [126.9, 37.5, 127.1, 37.8],
  tileSize: 256,
  encoding: "mapbox",
};

test("Terrain source API 주소는 백엔드 기준 주소와 결합한다", () => {
  assert.equal(
    terrainSourceUrl("http://localhost:8080/"),
    "http://localhost:8080/api/v1/terrain/source",
  );
});

test("MapLibre raster-dem 응답을 검증하고 좌표 범위를 튜플로 유지한다", () => {
  assert.deepEqual(parseTerrainSource(source), source);
  assert.throws(
    () => parseTerrainSource({ ...source, type: "raster" }),
    /Terrain source/,
  );
  assert.throws(
    () => parseTerrainSource({ ...source, bounds: [126.9, 37.5] }),
    /Terrain source/,
  );
});

test("Terrain과 Hillshade는 별도 raster-dem source를 사용하고 코스 레이어 아래에 둔다", () => {
  const sources = new Map();
  const layers = new Map();
  const beforeIds = [];
  const map = {
    getSource: id => sources.get(id),
    addSource: (id, value) => sources.set(id, value),
    getLayer: id => layers.get(id),
    addLayer: (layer, beforeId) => {
      layers.set(layer.id, layer);
      beforeIds.push(beforeId);
    },
  };

  installTerrainLayers(map, source, "course-route-a");

  assert.notEqual(TERRAIN_SOURCE_ID, HILLSHADE_SOURCE_ID);
  assert.deepEqual(sources.get(TERRAIN_SOURCE_ID), source);
  assert.deepEqual(sources.get(HILLSHADE_SOURCE_ID), source);
  assert.equal(layers.get(HILLSHADE_LAYER_ID).source, HILLSHADE_SOURCE_ID);
  assert.deepEqual(beforeIds, ["course-route-a"]);
});

test("CourseRouteMap의 전용 경로 레이어 아래에도 Hillshade를 배치한다", () => {
  const beforeIds = [];
  const map = {
    getSource: () => undefined,
    addSource: () => {},
    getLayer: () => undefined,
    addLayer: (_layer, beforeId) => beforeIds.push(beforeId),
  };

  installTerrainLayers(map, source, "discovery-course-lines");

  assert.deepEqual(beforeIds, ["discovery-course-lines"]);
});

test("Terrain 레이어를 해제할 때 Terrain, Hillshade, source 순서로 정리한다", () => {
  const operations = [];
  const map = {
    getSource: () => ({}),
    getLayer: () => ({}),
    setTerrain: value => operations.push(["terrain", value]),
    removeLayer: id => operations.push(["layer", id]),
    removeSource: id => operations.push(["source", id]),
  };

  removeTerrainLayers(map);

  assert.deepEqual(operations, [
    ["terrain", null],
    ["layer", HILLSHADE_LAYER_ID],
    ["source", HILLSHADE_SOURCE_ID],
    ["source", TERRAIN_SOURCE_ID],
  ]);
  assert.equal(supportsTerrain("bukhansan"), true);
  assert.equal(supportsTerrain("seoraksan"), false);
});

test("Terrain source는 화면 이동 동안 재사용하고 명시적 재시도 때 갱신한다", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify(source), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await loadTerrainSource({ forceRefresh: true });
    await loadTerrainSource();
    assert.equal(requestCount, 1);

    await loadTerrainSource({ forceRefresh: true });
    assert.equal(requestCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Terrain source 요청이 실패하거나 제한 시간을 넘기면 다음 요청을 재시도한다", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async (_url, options) => {
    requestCount += 1;
    if (requestCount === 1) {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    }
    return new Response(JSON.stringify(source), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await assert.rejects(loadTerrainSource({ forceRefresh: true, timeoutMs: 5 }), /Aborted/);
    assert.deepEqual(await loadTerrainSource(), source);
    assert.equal(requestCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Terrain source 오류만 일반 지도 오류와 구분한다", () => {
  assert.equal(isTerrainSourceError({ sourceId: TERRAIN_SOURCE_ID }), true);
  assert.equal(isTerrainSourceError({ sourceId: HILLSHADE_SOURCE_ID }), true);
  assert.equal(isTerrainSourceError({ sourceId: "openfreemap" }), false);
  assert.equal(isTerrainSourceError(new Error("network")), false);
});

test("3D는 Terrain과 pitch를 적용하고 2D는 Terrain을 해제한다", () => {
  const terrains = [];
  const pitches = [];
  const map = {
    getSource: id => id === TERRAIN_SOURCE_ID ? {} : undefined,
    setTerrain: value => terrains.push(value),
    easeTo: value => pitches.push(value.pitch),
  };

  assert.equal(applyTerrainMode(map, "3D"), true);
  assert.equal(applyTerrainMode(map, "2D"), true);
  assert.deepEqual(terrains, [
    { source: TERRAIN_SOURCE_ID, exaggeration: 1 },
    null,
  ]);
  assert.deepEqual(pitches, [50, 0]);
});
