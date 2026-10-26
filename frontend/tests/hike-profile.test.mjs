import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_NICKNAME,
  NICKNAME_MAX_LENGTH,
  fetchUserProfile,
  updateUserNickname,
} from "../src/api/profile.ts";

test("닉네임 기본값은 사용자 번호가 붙은 익명이다", () => {
  assert.equal(DEFAULT_NICKNAME, "익명1");
  assert.equal(NICKNAME_MAX_LENGTH, 12);
});

test("사용자 API로 닉네임을 조회하고 변경한다", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ data: { userId: 1, nickname: "산다람쥐" } });
  };

  assert.equal((await fetchUserProfile()).nickname, "산다람쥐");
  assert.equal((await updateUserNickname("새이름")).nickname, "산다람쥐");
  assert.equal(calls[0].url, "http://localhost:8080/api/v1/users/me");
  assert.equal(calls[0].init.headers["X-User-Id"], "1");
  assert.equal(calls[1].init.method, "PATCH");
  assert.equal(calls[1].init.body, JSON.stringify({ nickname: "새이름" }));
});

test("사용자 API 오류 메시지를 전달한다", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => { throw new TypeError("network"); };
  await assert.rejects(fetchUserProfile(), /서버에 연결하지 못했어요/);

  globalThis.fetch = async () => Response.json({ message: "사용자를 찾을 수 없습니다." }, { status: 404 });
  await assert.rejects(fetchUserProfile(), /사용자를 찾을 수 없습니다/);
});
