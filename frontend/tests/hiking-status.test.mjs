import test from "node:test";
import assert from "node:assert/strict";
import { resolveLocationGuideState } from "../src/utils/hikingStatus.ts";

test("권한 요청을 거부하면 재시도 안내 상태를 반환한다", () => {
  assert.equal(resolveLocationGuideState(1), "denied");
});

test("브라우저에서 위치 권한이 차단된 경우 설정 안내 상태를 반환한다", () => {
  assert.equal(resolveLocationGuideState(1, true), "blocked");
});

test("GPS 수신 실패와 시간 초과는 권한 차단으로 분류하지 않는다", () => {
  assert.equal(resolveLocationGuideState(2), "unavailable");
  assert.equal(resolveLocationGuideState(3), "unavailable");
});
