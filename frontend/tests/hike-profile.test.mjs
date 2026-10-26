import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_NICKNAME, NICKNAME_MAX_LENGTH, getNickname, normalizeNickname, setNickname } from "../src/store/profileStore.ts";

test("닉네임 기본값은 익명이다", () => {
  assert.equal(getNickname(), DEFAULT_NICKNAME);
  assert.equal(DEFAULT_NICKNAME, "익명");
});

test("닉네임은 앞뒤 공백을 지우고 최대 길이까지만 저장한다", () => {
  setNickname("  산다람쥐  ");
  assert.equal(getNickname(), "산다람쥐");
  setNickname("가".repeat(NICKNAME_MAX_LENGTH + 5));
  assert.equal(getNickname().length, NICKNAME_MAX_LENGTH);
});

test("닉네임을 비워 저장하면 익명으로 돌아간다", () => {
  setNickname("등산객");
  setNickname("   ");
  assert.equal(getNickname(), DEFAULT_NICKNAME);
  assert.equal(normalizeNickname(""), DEFAULT_NICKNAME);
});

test("닉네임 화면은 로컬 저장소 대신 사용자 API를 사용한다", () => {
  const api = readFileSync(new URL("../src/api/profile.ts", import.meta.url), "utf8");
  const card = readFileSync(new URL("../src/pages/HikeCalendarPage/components/NicknameCard.tsx", import.meta.url), "utf8");
  const store = readFileSync(new URL("../src/store/profileStore.ts", import.meta.url), "utf8");
  assert.match(api, /\/api\/v1\/users\/me/);
  assert.match(card, /fetchUserProfile\(\)/);
  assert.match(card, /updateUserNickname\(draft\)/);
  assert.doesNotMatch(store, /localStorage/);
});
