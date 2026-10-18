import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_NICKNAME, NICKNAME_MAX_LENGTH, getNickname, saveNickname } from "../src/store/profileStore.ts";

test("닉네임 기본값은 익명이다", () => {
  assert.equal(getNickname(), DEFAULT_NICKNAME);
  assert.equal(DEFAULT_NICKNAME, "익명");
});

test("닉네임은 앞뒤 공백을 지우고 최대 길이까지만 저장한다", () => {
  saveNickname("  산다람쥐  ");
  assert.equal(getNickname(), "산다람쥐");
  saveNickname("가".repeat(NICKNAME_MAX_LENGTH + 5));
  assert.equal(getNickname().length, NICKNAME_MAX_LENGTH);
});

test("닉네임을 비워 저장하면 익명으로 돌아간다", () => {
  saveNickname("등산객");
  saveNickname("   ");
  assert.equal(getNickname(), DEFAULT_NICKNAME);
});
