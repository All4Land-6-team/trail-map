import test from "node:test";
import assert from "node:assert/strict";
import { distanceMeters, isPathPosition } from "../src/utils/hikeTracking.ts";

const start = [126.9783, 37.5666];
// 위도 0.0001도 ≈ 11m
const near = [126.9783, 37.56662];
const far = [126.9783, 37.5667];

test("두 좌표 사이 거리를 미터로 계산한다", () => {
  assert.ok(Math.abs(distanceMeters(start, far) - 11.1) < 0.2);
});

test("첫 위치는 정확도가 충분하면 경로에 넣는다", () => {
  assert.equal(isPathPosition(undefined, start, 10), true);
});

test("정확도가 50m보다 나쁜 위치는 경로에서 뺀다", () => {
  assert.equal(isPathPosition(start, far, 51), false);
  assert.equal(isPathPosition(start, far, 50), true);
});

test("직전 위치와 5m보다 가까우면 제자리 흔들림으로 보고 뺀다", () => {
  assert.equal(isPathPosition(start, near, 5), false);
  assert.equal(isPathPosition(start, far, 5), true);
});

