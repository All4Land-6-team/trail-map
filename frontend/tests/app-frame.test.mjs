import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const frame = read('assets/css/app-frame.css');

test('모바일 기본은 전체 높이, 큰 브라우저만 40px 상하 여백을 사용한다', () => {
  assert.match(read('main.tsx'), /import '\.\/assets\/css\/app-frame\.css'/);
  assert.match(frame, /--app-frame-gap: 0px/);
  assert.match(frame, /--app-viewport-height: calc\(100dvh - var\(--app-frame-gap\) \* 2\)/);
  assert.match(frame, /@media \(min-width: 600px\) and \(min-height: 720px\) and \(display-mode: browser\)/);
  assert.match(frame, /--app-frame-gap: 40px/);
  assert.match(frame, /min-height: min\(640px, var\(--app-viewport-height\)\)/);
  for (const page of ['home-page', 'course-page', 'course-detail-page', 'community-page', 'cart-screen', 'hike-page', 'hike-screen']) {
    assert.ok(frame.includes(`.${page}`));
  }
  const courseList = read('pages/CourseListPage/CourseListPage.tsx');
  const rootClass = courseList.match(/<main ref=\{rootRef\} className="([^" ]+)/)?.[1];
  assert.ok(rootClass && frame.includes(`.${rootClass}`));
});

test('커뮤니티 시트와 공용 일정 모달은 줄어든 앱 높이를 사용한다', () => {
  for (const path of ['pages/CommunityPage/community.css', 'pages/CommunityPage/hooks/useCommunitySheet.ts']) {
    const source = read(path);
    assert.ok(source.includes('var(--app-viewport-height)'));
    assert.ok(!source.includes('100dvh'));
  }
  assert.match(read('components/hike/hike.css'), /inset: var\(--app-frame-gap\) 0/);
  assert.match(read('pages/CourseDetailPage/course-detail.css'), /top: calc\(var\(--app-frame-gap\) \+ 16px\)/);
});

test('지도 시트는 브라우저 높이가 아닌 실제 앱 높이를 측정한다', () => {
  const sheet = read('hooks/useResizableMapSheet.ts');
  assert.match(sheet, /getMapSheetLayout\(kind, root.clientHeight/);
  assert.match(sheet, /observer.observe\(root\)/);
});
