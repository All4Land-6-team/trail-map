import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_COMPARISON_COURSES,
  limitComparisonCourseIds,
  toggleComparisonCourseId,
} from "../src/pages/CartPage/data.ts";

test("비교 코스는 URL이나 초기 상태에 4개 이상 있어도 3개만 선택한다", () => {
  const availableIds = ["a", "b", "c", "d", "e"];

  assert.equal(MAX_COMPARISON_COURSES, 3);
  assert.deepEqual(limitComparisonCourseIds(availableIds, availableIds), ["a", "b", "c"]);
  assert.deepEqual(limitComparisonCourseIds(availableIds, ["d", "unknown", "b", "a", "c"]), ["a", "b", "c"]);
});

test("3개가 선택되면 네 번째 코스 추가를 거부하고 선택 해제는 허용한다", () => {
  const selected = new Set(["a", "b", "c"]);

  assert.equal(toggleComparisonCourseId(selected, "d"), null);
  assert.deepEqual([...toggleComparisonCourseId(selected, "b")], ["a", "c"]);
  assert.deepEqual([...toggleComparisonCourseId(new Set(["a", "b"]), "c")], ["a", "b", "c"]);
});
