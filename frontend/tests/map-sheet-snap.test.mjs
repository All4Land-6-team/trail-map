import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as snap from '../src/utils/mapSheetSnap.ts';
import * as preview from '../src/utils/sheetPreviewSession.ts';

test('커뮤니티와 같은 32px 접힘·170px 지도 여백·420px 지도 시트 기준을 사용한다', () => {
  assert.equal(snap.mapSheetMaximum(820, 72), 578);
  assert.equal(snap.mapSheetMaximum(480, 106), 204);
  assert.equal(snap.clampMapSheet(snap.MAP_SHEET_OPEN, snap.mapSheetMaximum(480, 106)), 204);
  assert.equal(snap.clampMapSheet(-100, 578), 32);
  assert.equal(snap.mapSheetMaximum(200, 72), 32);
});

test('드래그 중간값을 저장하지 않고 펼침 높이와 접힘 높이의 중간에서 안착을 나눈다', () => {
  assert.equal(snap.releasedMapSheetLevel(100, 300), 'peek');
  assert.equal(snap.releasedMapSheetLevel(166, 300), 'content');
  assert.equal(snap.releasedMapSheetLevel(250, 300), 'content');
});

// 실제 훅의 포인터·키보드·타이머를 실행한다. CSS 배치는 별도 브라우저 검증 대상이다.
function mountSheet(mapPreview = false) {
  const slots = [], effects = [], frames = new Map(), timers = new Map();
  let index = 0, id = 0, now = 0, resize, latest;
  const root = { clientHeight: 844, clientWidth: 390, naturalHeight: 300,
    getBoundingClientRect: () => ({ height: root.clientHeight }),
    querySelector: selector => selector === '.sheet' ? sheet : navigation };
  const sheet = { getBoundingClientRect: () => ({ height: height() }) };
  const navigation = { getBoundingClientRect: () => ({ height: 72 }) };
  const handle = { focus() {}, setPointerCapture() {}, hasPointerCapture: () => false };
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const react = {
    useRef(value) { const slot = index++; return slots[slot] ??= { current: value }; },
    useState(value) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof value === 'function' ? value() : value;
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
      if (!equal(slots[slot]?.dependencies, dependencies)) effects.push(() => {
        slots[slot]?.cleanup?.(); slots[slot] = { dependencies, cleanup: effect() };
      });
    },
  };
  const window = {
    requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout(callback, delay) { timers.set(++id, { callback, time: now + delay }); return id; },
    clearTimeout: id => timers.delete(id), performance: { now: () => now },
    addEventListener() {}, removeEventListener() {},
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/hooks/useSnappingMapSheet.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { exports, window,
    require: name => name === 'react' ? react : name.endsWith('mapSheetSnap') ? snap : name.endsWith('sheetPreviewSession') ? preview : {},
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
  });
  function height() {
    const maximum = snap.mapSheetMaximum(root.clientHeight, 72);
    const value = latest?.style['--map-sheet-height'] ?? 'auto';
    return snap.clampMapSheet(value === 'auto' ? root.naturalHeight : value.startsWith('min(') ? 420 : Number.parseFloat(value), maximum);
  }
  function render() {
    index = 0;
    latest = exports.useSnappingMapSheet({ sheetSelector: '.sheet', navigationSelector: '.nav', label: '시트', mapPreview, trackSettledInset: true });
    latest.rootRef.current = root;
    effects.splice(0).forEach(effect => effect());
    return latest;
  }
  function flushFrames() {
    for (let round = 0; frames.size && round < 10; round++) {
      const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); render();
    }
    assert.equal(frames.size, 0);
  }
  function advance(ms) {
    now += ms;
    for (const [id, timer] of timers) if (timer.time <= now) { timers.delete(id); timer.callback(); }
    render();
  }
  render(); render();
  return { render, root, height, flushFrames, advance,
    settled: () => { flushFrames(); advance(snap.MAP_SHEET_SETTLE_MS); },
    event: (clientY = 400) => ({ pointerId: 1, isPrimary: true, pointerType: 'touch', clientY, currentTarget: handle }),
    resize: () => { resize(); flushFrames(); },
    unmount: () => slots.forEach(slot => slot?.cleanup?.()), frames, timers,
  };
}

test('실제 훅은 탭·방향키·Enter·Space로 접고 펼치며 안착 후 auto 높이로 돌아간다', () => {
  const sheet = mountSheet();
  assert.equal(sheet.height(), 300);
  assert.equal(sheet.render().style['--map-sheet-height'], 'auto');
  sheet.render().handleProps.onClick({ detail: 1 }); sheet.settled();
  assert.equal(sheet.height(), 32); assert.equal(sheet.render().peek, true);
  for (const key of ['ArrowUp', 'Home', 'Enter', ' ']) {
    sheet.render().handleProps.onKeyDown({ key, preventDefault() {} }); sheet.settled();
    assert.equal(sheet.height(), 300); assert.equal(sheet.render().peek, false);
    sheet.render().handleProps.onKeyDown({ key: 'End', preventDefault() {} }); sheet.settled();
  }
  sheet.unmount();
});

test('임계점 아래 드래그는 32px로 안착하고 뒤따르는 합성 클릭이 다시 열지 않는다', () => {
  const sheet = mountSheet();
  sheet.render().handleProps.onPointerDown(sheet.event());
  sheet.render().handleProps.onPointerMove(sheet.event(600)); sheet.render();
  assert.equal(sheet.height(), 100);
  sheet.render().handleProps.onPointerUp(sheet.event(600)); sheet.settled();
  assert.equal(sheet.height(), 32);
  sheet.render().handleProps.onClick({ detail: 1 }); sheet.settled();
  assert.equal(sheet.height(), 32);
  sheet.render().handleProps.onClick({ detail: 0 }); sheet.settled();
  assert.equal(sheet.height(), 300);
  sheet.unmount();
});

test('드래그 취소·화면 축소는 기존 단계를 유지하고 높이를 앱 안으로 보정한다', () => {
  const sheet = mountSheet(true);
  assert.equal(sheet.height(), 420);
  sheet.render().handleProps.onPointerDown(sheet.event());
  sheet.render().handleProps.onPointerMove(sheet.event(500)); sheet.render();
  sheet.render().handleProps.onPointerCancel(sheet.event(500)); sheet.render();
  assert.equal(sheet.height(), 420);
  sheet.root.clientHeight = 480; sheet.resize();
  assert.equal(sheet.height(), 238);
  assert.equal(sheet.render().mapBottomInset, 238);
  sheet.unmount();
});

test('코스 미리보기 종료는 사용자 탭·진행 중인 드래그 선택을 덮어쓰지 않는다', () => {
  const sheet = mountSheet();
  const controls = sheet.render().previewControls;
  controls.begin(); sheet.settled(); assert.equal(sheet.height(), 32);
  controls.end(); sheet.settled(); assert.equal(sheet.height(), 300);
  assert.equal(sheet.render().previewControls, controls);
  controls.begin(); sheet.settled();
  sheet.render().handleProps.onPointerDown(sheet.event());
  sheet.render().handleProps.onPointerMove(sheet.event(250)); sheet.render();
  const before = sheet.height(); controls.end(); sheet.render();
  assert.equal(sheet.height(), before);
  sheet.render().handleProps.onPointerUp(sheet.event(250)); sheet.settled();
  assert.equal(sheet.height(), 300);
  sheet.unmount();
});
