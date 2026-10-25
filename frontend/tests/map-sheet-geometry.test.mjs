import assert from "node:assert/strict";
import test from "node:test";
import { clampSheetHeight, getMapSheetLayout } from "../src/utils/mapSheetGeometry.ts";

test("홈은 기본 165px, 낮은 화면은 150px에서 조절을 시작한다", () => {
  assert.equal(getMapSheetLayout("home", 844, 72).initial, 165);
  assert.equal(getMapSheetLayout("home", 568, 72).initial, 150);
});

test("코스 목록의 기존 296px 기본 높이를 유지한다", () => {
  assert.equal(getMapSheetLayout("courses", 844, 72).initial, 296);
});

test("상세 화면의 기존 지도 노출 높이와 하단 버튼 공간을 유지한다", () => {
  assert.deepEqual(getMapSheetLayout("detail", 844, 72), { minimum: 140, maximum: 672, initial: 500 });
});

test("안전 영역이 포함된 내비게이션의 실제 높이를 제외한다", () => {
  for (const kind of ["home", "courses", "detail"]) {
    const normal = getMapSheetLayout(kind, 844, 72);
    const safeArea = getMapSheetLayout(kind, 844, 106);
    assert.equal(normal.maximum - safeArea.maximum, 34);
  }
});

test("아주 낮은 화면에서도 최소·기본·최대 높이 순서와 지도 여백을 지킨다", () => {
  for (const kind of ["home", "courses", "detail"]) {
    for (const height of [0, 120, 240, 320, 480, 568, 844, 1419]) {
      const layout = getMapSheetLayout(kind, height, 72);
      assert.ok(layout.minimum >= 0);
      assert.ok(layout.minimum <= layout.initial && layout.initial <= layout.maximum);
      assert.ok(layout.maximum <= Math.max(0, height - 72));
    }
  }
});

test("범위를 벗어난 드래그와 화면 축소 후 높이를 현재 범위로 제한한다", () => {
  const layout = getMapSheetLayout("courses", 480, 72);
  assert.equal(clampSheetHeight(-100, layout.minimum, layout.maximum), layout.minimum);
  assert.equal(clampSheetHeight(900, layout.minimum, layout.maximum), layout.maximum);
  assert.equal(clampSheetHeight(220, layout.minimum, layout.maximum), 220);
});
