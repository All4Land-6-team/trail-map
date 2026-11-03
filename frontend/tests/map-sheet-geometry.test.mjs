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

test("개선 코스 화면만 480px 높이에서 지도 240px와 시트 최소 160px를 확보한다", () => {
  assert.deepEqual(getMapSheetLayout("courses", 480, 72, 240), { minimum: 160, maximum: 168, initial: 168 });
  assert.equal(getMapSheetLayout("courses", 844, 72, 240).initial, 296);
  assert.equal(getMapSheetLayout("courses", 480, 72).initial, 296);
});

test("최소 지도 높이를 요청해도 좁은 화면과 안전 영역에서 시트 높이 순서를 지킨다", () => {
  for (const height of [0, 120, 240, 320, 480, 568, 844]) {
    for (const navigation of [72, 106]) {
      const layout = getMapSheetLayout("courses", height, navigation, 240);
      assert.ok(layout.minimum >= 0);
      assert.ok(layout.minimum <= layout.initial && layout.initial <= layout.maximum);
      assert.ok(layout.maximum <= Math.max(0, height - navigation));
      if (height - navigation >= 260) assert.equal(layout.minimum, 160);
      if (height - navigation >= 400) assert.ok(height - navigation - layout.maximum >= 240);
    }
  }
});

test("홈·목록은 화면이 커도 실제 콘텐츠보다 더 확장되지 않는다", () => {
  assert.deepEqual(getMapSheetLayout("home", 844, 72, 0, 135), { minimum: 100, initial: 135, maximum: 135 });
  assert.deepEqual(getMapSheetLayout("courses", 844, 72, 240, 296), { minimum: 160, initial: 296, maximum: 296 });
  assert.equal(getMapSheetLayout("courses", 1419, 72, 240, 296).maximum, 296);
  assert.equal(getMapSheetLayout("home", 844, 72, 0, 90).minimum, 90);
  assert.equal(getMapSheetLayout("home", 844, 72, 0, 190.2).maximum, 191);
});

test("비교는 326px부터 실제 앱 높이까지 확장하되 지도 도구와 안전 영역을 남긴다", () => {
  assert.deepEqual(getMapSheetLayout("comparison", 820, 72, 181), { minimum: 28, initial: 326, maximum: 567 });
  assert.equal(getMapSheetLayout("comparison", 820, 106, 181).maximum, 533);
  assert.deepEqual(getMapSheetLayout("comparison", 480, 72, 181), { minimum: 28, initial: 227, maximum: 227 });
  for (const kind of ["home", "courses", "comparison"]) {
    for (const page of [0, 120, 320, 480, 820, 1419]) {
      const layout = getMapSheetLayout(kind, page, 106, 240, kind === "comparison" ? undefined : 296);
      assert.ok(0 <= layout.minimum && layout.minimum <= layout.initial && layout.initial <= layout.maximum);
      assert.ok(layout.maximum <= Math.max(0, page - 106));
    }
  }
});
