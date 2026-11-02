import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("로그인과 회원가입 화면은 공통 레이아웃 입력창과 버튼을 사용한다", () => {
  const source = readFileSync(new URL("../src/pages/AuthPage/AuthPage.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../src/pages/AuthPage/AuthLayout.tsx", import.meta.url), "utf8");
  assert.match(source, /<AuthLayout mode=\{mode\}>/);
  assert.match(source, /<Field[^>]*label="닉네임"/);
  assert.match(source, /<Field[^>]*label="이메일"/);
  assert.match(source, /<Field[^>]*label="비밀번호"/);
  assert.match(source, /passwordVisible/);
  assert.match(source, /validateEmail/);
  assert.match(source, /validatePassword/);
  assert.match(source, /reason instanceof AuthApiError && reason\.status === 409/);
  assert.match(source, /<Button type="submit" fullWidth/);
  assert.match(source, /href=\{isSignup \? "#login" : "#signup"\}/);
  assert.match(layout, /trailmap-logo\.png/);
  assert.doesNotMatch(layout, /trailmap-hero\.webp/);
  assert.doesNotMatch(layout, /오늘의 산길을|코스를 찾고/);
});

test("인증 화면은 V4 공통 Field의 후행 컨트롤로 비밀번호 표시를 전환한다", () => {
  const field = readFileSync(new URL("../src/components/common/Field/Field.tsx", import.meta.url), "utf8");
  assert.match(field, /trailingControl\?: ReactNode/);
  assert.match(field, /af-field__trailing/);
});

test("인증 API는 회원가입 로그인 현재 사용자 로그아웃을 제공한다", () => {
  const source = readFileSync(new URL("../src/api/auth.ts", import.meta.url), "utf8");
  assert.match(source, /\/signup/);
  assert.match(source, /\/login/);
  assert.match(source, /\/me/);
  assert.match(source, /\/logout/);
  assert.match(source, /authHeaders/);
});

test("기존 사용자 API는 임시 사용자 번호 대신 인증 헤더를 사용한다", () => {
  for (const path of ["community.ts", "profile.ts", "hikeScheduleApi.ts", "hikeRecordApi.ts"]) {
    const source = readFileSync(new URL(`../src/api/${path}`, import.meta.url), "utf8");
    assert.match(source, /authHeaders/);
    assert.doesNotMatch(source, /X-User-Id|VITE_HIKE_USER_ID/);
  }
});
