import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as geometry from '../src/utils/mapSheetGeometry.ts';
import * as previewSession from '../src/utils/sheetPreviewSession.ts';

// Small hook adapter executes the actual hook's event handlers without adding a DOM library.
function mountSheet(trackSettledInset = true, minimumMapHeight = 0, kind = 'courses') {
  const slots = [], pendingEffects = [], frames = new Map(), listeners = new Map();
  let index = 0, nextFrame = 0, resize;
  const handle = { setAttribute() {}, focus() {}, setPointerCapture() {}, hasPointerCapture: () => false };
  const navigation = { getBoundingClientRect: () => ({ height: 72 }) };
  const properties = new Map();
  const root = { clientHeight: 844, style: { setProperty: (key, value) => properties.set(key, value) },
    querySelector: selector => selector === '[data-map-sheet-handle]' ? handle : navigation };
  const equal = (a, b) => a && b && a.length === b.length && a.every((item, i) => item === b[i]);
  const react = {
    useRef(initial) { const slot = index++; return slots[slot] ??= { current: initial }; },
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
      return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
    },
    useMemo(factory, dependencies) {
      const slot = index++;
      if (!equal(slots[slot]?.dependencies, dependencies)) slots[slot] = { value: factory(), dependencies };
      return slots[slot].value;
    },
    useCallback(callback, dependencies) { return react.useMemo(() => callback, dependencies); },
    useLayoutEffect(effect, dependencies) {
      const slot = index++;
      if (!equal(slots[slot]?.dependencies, dependencies)) pendingEffects.push(() => {
        slots[slot]?.cleanup?.(); slots[slot] = { dependencies, cleanup: effect() };
      });
    },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/hooks/useResizableMapSheet.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require: name => name === 'react' ? react : name.endsWith('mapSheetGeometry') ? geometry : name.endsWith('sheetPreviewSession') ? previewSession : {},
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} unobserve() {} disconnect() {} },
    window: { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  function render() {
    index = 0;
    const result = exports.useResizableMapSheet({ kind, navigationSelector: '.navigation', label: '시트', trackSettledInset, minimumMapHeight });
    result.rootRef.current = root;
    pendingEffects.splice(0).forEach(effect => effect());
    return result;
  }
  render();
  return { render, root, height: () => Number.parseFloat(properties.get('--map-sheet-height')),
    resize: () => { resize(); const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); },
    event: (clientY = 400) => ({ pointerId: 1, isPrimary: true, pointerType: 'touch', clientY, currentTarget: handle }),
    flushFrame: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); },
    unmount: () => slots.forEach(slot => slot?.cleanup?.()), frames,
  };
}

test('실제 훅의 previewControls는 재렌더에도 안정적이고 기본 높이로 복원한다', () => {
  const sheet = mountSheet();
  let result = sheet.render();
  const controls = result.previewControls;
  controls.begin(); result = sheet.render();
  assert.equal(sheet.height(), 160); assert.equal(result.mapBottomInset, 160);
  assert.equal(result.previewControls, controls);
  controls.begin(); controls.end(); result = sheet.render();
  assert.equal(sheet.height(), 296); assert.equal(result.mapBottomInset, 296);
  sheet.unmount();
});

test('미완료 포인터 드래그 도중 미리보기가 끝나도 사용자 프레임과 높이를 보존한다', () => {
  const sheet = mountSheet();
  const result = sheet.render();
  result.previewControls.begin();
  result.handleProps.onPointerDown(sheet.event());
  result.handleProps.onPointerMove(sheet.event(350));
  result.previewControls.end();
  assert.equal(sheet.frames.size, 1);
  sheet.flushFrame();
  assert.equal(sheet.height(), 210);
  result.handleProps.onPointerUp(sheet.event(350));
  assert.equal(sheet.render().mapBottomInset, 210);
  sheet.unmount();
});

test('키보드와 뷰포트 변경 후 높이를 덮어쓰지 않고 기본 사용자는 기존 지도 여백을 유지한다', () => {
  const sheet = mountSheet(false);
  const result = sheet.render();
  result.previewControls.begin();
  result.handleProps.onKeyDown({ key: 'ArrowUp', preventDefault() {} });
  result.previewControls.end();
  assert.equal(sheet.height(), 184);
  assert.equal(sheet.render().mapBottomInset, 296);
  result.previewControls.begin();
  sheet.root.clientHeight = 500; sheet.resize();
  result.previewControls.end();
  assert.equal(sheet.height(), 160);
  sheet.unmount();
});

test('개선 목록의 최소 지도 높이는 작은 화면의 초기·키보드 최대 시트 높이를 제한한다', () => {
  const sheet = mountSheet(true, 240);
  assert.equal(sheet.height(), 296);
  sheet.root.clientHeight = 480; sheet.resize();
  let result = sheet.render();
  assert.equal(sheet.height(), 168); assert.equal(result.mapBottomInset, 168);
  result.handleProps.onKeyDown({ key: 'Home', preventDefault() {} });
  assert.equal(sheet.height(), 168);
  result.previewControls.begin(); assert.equal(sheet.height(), 160);
  result.previewControls.end(); result = sheet.render();
  assert.equal(result.mapBottomInset, 168);
  sheet.unmount();
});

test('한계가 바뀌지 않은 크기 알림은 진행 중인 드래그를 취소하지 않는다', () => {
  const sheet = mountSheet();
  const result = sheet.render();
  result.handleProps.onPointerDown(sheet.event());
  sheet.resize();
  result.handleProps.onPointerMove(sheet.event(300));
  sheet.flushFrame();
  assert.equal(sheet.height(), 396);
  result.handleProps.onPointerCancel(sheet.event(300));
  assert.equal(sheet.render().mapBottomInset, 396);
  sheet.unmount();
});

test('비교 시트는 기본 높이보다 확장하고 접혀도 차트 본문을 언마운트하지 않는다', () => {
  const sheet = mountSheet(false, 0, 'comparison');
  const result = sheet.render();
  assert.equal(sheet.height(), 326);
  result.handleProps.onKeyDown({ key: 'Home', preventDefault() {} });
  assert.equal(sheet.height(), 592);
  assert.equal(sheet.render().mapBottomInset, 326);
  result.handleProps.onKeyDown({ key: 'End', preventDefault() {} });
  assert.equal(sheet.height(), 28);
  assert.equal(sheet.render().bodyHidden, true);
  sheet.root.clientHeight = 480; sheet.resize();
  assert.equal(sheet.height(), 28);
  result.handleProps.onKeyDown({ key: 'Home', preventDefault() {} });
  assert.equal(sheet.height(), 228);
  assert.equal(sheet.render().bodyHidden, false);
  sheet.unmount();
});
