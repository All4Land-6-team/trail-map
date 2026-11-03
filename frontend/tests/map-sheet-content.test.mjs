import assert from 'node:assert/strict';
import test from 'node:test';
import { measureMapSheetContent } from '../src/utils/mapSheetContent.ts';

class Box {
  constructor(height, style = {}, children = []) { this.height = height; this.style = style; this.children = children; }
  getBoundingClientRect() { return { height: this.height }; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
}
const originalElement = globalThis.HTMLElement, originalStyle = globalThis.getComputedStyle;
globalThis.HTMLElement = Box;
globalThis.getComputedStyle = element => new Proxy(element.style, { get: (style, key) => style[key] ?? '0px' });
test.after(() => { globalThis.HTMLElement = originalElement; globalThis.getComputedStyle = originalStyle; });

function fixture() {
  const content = new Box(31);
  const viewport = new Box(1000, { marginTop: '9px' }, [content]);
  const title = new Box(26, { marginTop: '13px' });
  const description = new Box(18, { marginTop: '3px' });
  const body = new Box(2000, {}, [title, description, viewport]);
  const sheet = new Box(2200, { paddingTop: '8px', paddingBottom: '12px' }, [new Box(4), body]);
  sheet.querySelector = selector => selector === '.af-bottom-sheet__body' ? body : viewport;
  return { sheet, body, content, viewport, description };
}

test('확장된 본문과 스크롤 영역에 빈 공간이 있어도 실제 콘텐츠·제목·여백만 합산한다', () => {
  const view = fixture();
  assert.equal(measureMapSheetContent(view.sheet, view.content), 124);
  view.sheet.height = 3000; view.body.height = 2900; view.viewport.height = 2800;
  assert.equal(measureMapSheetContent(view.sheet, view.content), 124);
  view.content.height = 61;
  assert.equal(measureMapSheetContent(view.sheet, view.content), 154);
});

test('본문과 시트의 간격·테두리·스크롤 영역 패딩을 포함한다', () => {
  const view = fixture();
  view.body.style.rowGap = '4px'; view.sheet.style.rowGap = '5px';
  Object.assign(view.viewport.style, { paddingTop: '2px', paddingBottom: '3px', borderTopWidth: '1px', borderBottomWidth: '1px' });
  Object.assign(view.content.style, { marginTop: '2px', marginBottom: '1px' });
  assert.equal(measureMapSheetContent(view.sheet, view.content), 147);
});

test('숨겨진 설명과 아직 연결되지 않은 콘텐츠는 최대 높이를 부풀리지 않는다', () => {
  const view = fixture();
  view.description.style.display = 'none';
  assert.equal(measureMapSheetContent(view.sheet, view.content), 103);
  assert.equal(measureMapSheetContent(view.sheet, new Box(100)), undefined);
});
