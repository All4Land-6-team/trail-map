import test from "node:test";
import assert from "node:assert/strict";
import { courseProgress, distanceMeters, isPathPosition, pathLengthMeters } from "../src/utils/hikeTracking.ts";

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


// 북쪽으로 약 1.11km 올라간 뒤 동쪽으로 꺾는 코스. 위도 0.001도 ≈ 111m
const course = [[126.95, 37.63], [126.95, 37.64], [126.96, 37.64]];
const near1 = (actual, expected, tolerance = 2) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test("코스 위 위치는 시작점부터의 코스 길이를 진행 거리로, 나머지를 남은 거리로 계산한다", () => {
  const progress = courseProgress(course, [126.95, 37.635]);
  near1(progress.alongMeters, 556);
  near1(progress.remainingMeters, progress.totalMeters - 556);
  near1(progress.offCourseMeters, 0, 0.5);
});

test("코스에서 조금 벗어난 위치는 코스 선의 가장 가까운 지점 기준으로 계산한다", () => {
  // 코스 서쪽으로 약 30m 떨어진 위치. 진행 거리는 코스 위에 있을 때와 같다.
  const progress = courseProgress(course, [126.94966, 37.635]);
  near1(progress.alongMeters, 556);
  near1(progress.offCourseMeters, 30, 1.5);
});

test("코스 끝을 지나면 남은 거리는 0이다", () => {
  assert.equal(courseProgress(course, [126.97, 37.64]).remainingMeters, 0);
});

test("코스 좌표가 2개 미만이면 계산하지 않는다", () => {
  assert.equal(courseProgress([[126.95, 37.63]], [126.95, 37.63]), null);
});

// 갔다가 되돌아오는 지그재그 코스: 첫 구간과 셋째 구간이 약 20m 간격으로 나란하다.
const zigzag = [[126.95, 37.63], [126.95, 37.635], [126.95023, 37.635], [126.95023, 37.63]];

test("지그재그 구간에서는 직전 진행 지점 근처 구간을 먼저 찾아 진행 거리가 뒤로 튀지 않는다", () => {
  const position = [126.9501, 37.6301];
  // 처음이면 가장 가까운 첫 구간
  near1(courseProgress(zigzag, position).alongMeters, 11);
  // 이미 셋째 구간까지 왔으면 같은 위치도 셋째 구간으로 본다
  const previous = courseProgress(zigzag, [126.95023, 37.632]).alongMeters;
  assert.ok(courseProgress(zigzag, position, previous).alongMeters > previous);
});

test("직전 진행 지점 근처 구간에서 멀리 떨어져 있으면 코스 전체에서 다시 찾는다", () => {
  const progress = courseProgress(course, [126.95, 37.631], 1_500);
  near1(progress.alongMeters, 111);
});

test("화면에 바로 보여 줄 이동 거리는 경로 구간 길이의 합이다", () => {
  assert.equal(pathLengthMeters([]), 0);
  assert.equal(pathLengthMeters([[126.95, 37.63]]), 0);
  near1(pathLengthMeters(course), distanceMeters(course[0], course[1]) + distanceMeters(course[1], course[2]), 0.01);
});
