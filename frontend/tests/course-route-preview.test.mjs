import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as motion from '../src/utils/courseRouteMotion.ts';
import { createPreviewClock } from '../src/components/map/routeMapCamera.ts';

// Run actual hook effects/handlers against a deterministic MapLibre/RAF adapter.
function mountPreview(reduced = false) {
  const slots = [], effects = [], frames = new Map(), listeners = new Map(), documentListeners = new Map(), markers = [];
  const counts = { start: 0, end: 0, overview: 0, stop: 0, follow: 0, interrupted: 0 };
  let index = 0, nextFrame = 0, now = 0;
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const react = {
    useRef(initial) { const slot = index++; return slots[slot] ??= { current: initial }; },
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
    },
    useCallback(callback, dependencies) {
      const slot = index++;
      if (!equal(slots[slot]?.dependencies, dependencies)) slots[slot] = { dependencies, value: callback };
      return slots[slot].value;
    },
    useEffect(effect, dependencies) {
      const slot = index++;
      if (!equal(slots[slot]?.dependencies, dependencies)) effects.push(() => {
        slots[slot]?.cleanup?.(); slots[slot] = { dependencies, cleanup: effect() };
      });
    },
  };
  const map = {
    gestureActive: false,
    on(name, callback) { listeners.set(name, callback); }, off(name) { listeners.delete(name); },
    stop() { counts.stop++; this.gestureActive = false; }, getLayer: () => true, setPaintProperty() {},
    getBearing: () => 0, getZoom: () => 13,
    easeTo() { counts.follow++; listeners.get('zoomstart')?.({}); },
  };
  const document = { hidden: false, createElement: () => ({ setAttribute() {} }),
    addEventListener: (name, callback) => documentListeners.set(name, callback), removeEventListener: name => documentListeners.delete(name) };
  class Marker {
    constructor() { this.removed = false; markers.push(this); }
    setLngLat(coordinate) { this.coordinate = coordinate; return this; }
    addTo() { return this; }
    remove() { this.removed = true; }
  }
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/map/useCourseRoutePreview.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: name => name === 'react' ? react : name === 'maplibre-gl' ? { Marker }
    : name.endsWith('courseRouteMotion') ? motion
      : name.endsWith('routeMapCamera') ? { createPreviewClock, measureMapPadding: () => ({ left: 30, right: 80, top: 100, bottom: 160 }) }
        : { ENHANCED_ROUTE_LINE: 'enhanced-route-line-', reducedRouteMotion: () => reduced },
    document, performance: { now: () => now },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: frame => frames.delete(frame),
  });
  let options = { map, enabled: true, courseId: 'a', metrics: motion.buildRouteMetrics([[127, 37], [127.01, 37.01]]), activeSlot: { current: 1 },
    onStart: () => counts.start++, onEnd: () => counts.end++, fitWhole: () => counts.overview++, interruptCamera: () => counts.interrupted++ };
  const render = (changes = {}) => {
    options = { ...options, ...changes }; index = 0;
    const result = exports.useCourseRoutePreview(options); effects.splice(0).forEach(effect => effect()); return result;
  };
  return { render, frames, counts, markers, listeners, documentListeners,
    advance(value) { now += value; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); },
    gesture(originalEvent) { map.gestureActive = !!originalEvent; listeners.get('dragstart')?.({ originalEvent }); return map.gestureActive; },
    hide() { document.hidden = true; documentListeners.get('visibilitychange')?.(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('actual preview hook starts only on play, completes at twelve seconds and restores the sheet once', () => {
  const app = mountPreview();
  let result = app.render();
  assert.equal(result.state, 'idle'); assert.equal(app.frames.size, 0);
  result.play(); result = app.render();
  assert.equal(result.state, 'playing'); assert.equal(app.counts.start, 1);
  app.advance(6000); assert.ok(app.markers[0].coordinate[0] > 127);
  assert.equal(app.render().state, 'playing'); // Programmatic easeTo does not pause itself.
  app.advance(6000);
  assert.equal(app.render().state, 'idle'); assert.equal(app.frames.size, 0);
  assert.equal(app.counts.end, 1); assert.equal(app.counts.overview, 1);
  assert.equal(app.markers[0].removed, true);
  app.unmount(); assert.equal(app.counts.end, 1);
});

test('actual user gesture and hidden tab pause without auto-resume or consuming elapsed tour time', () => {
  const app = mountPreview(); app.render().play(); app.advance(2000);
  app.gesture(undefined); assert.equal(app.render().state, 'playing');
  assert.equal(app.gesture({ type: 'pointermove' }), true, 'pausing playback must preserve the active drag');
  assert.equal(app.render().state, 'paused');
  app.advance(30000); assert.equal(app.frames.size, 0);
  app.render().play(); app.advance(2000); assert.equal(app.render().state, 'playing');
  const stopsBeforeHide = app.counts.stop;
  app.hide(); assert.equal(app.render().state, 'paused'); assert.equal(app.counts.start, 1);
  assert.equal(app.counts.stop, stopsBeforeHide + 1, 'hidden tab still stops camera animation');
  app.render().play();
  const stopsBeforePause = app.counts.stop;
  app.render().pause(); assert.equal(app.render().state, 'paused');
  assert.equal(app.counts.stop, stopsBeforePause + 1, 'pause button still stops camera animation');
  app.render().finish(); assert.equal(app.counts.end, 1); assert.equal(app.counts.overview, 1);
  app.unmount();
});

test('course change, mode exit and unmount cancel frames/markers and notify sheet lifecycle exactly once', () => {
  for (const change of [{ courseId: 'b', metrics: motion.buildRouteMetrics([[128, 37], [128.01, 37.01]]) }, { enabled: false }, null]) {
    const app = mountPreview(); app.render().play(); app.advance(1000);
    if (change) app.render(change); else app.unmount();
    assert.equal(app.frames.size, 0); assert.equal(app.markers[0].removed, true);
    assert.equal(app.counts.end, 1); assert.equal(app.counts.overview, 0);
    if (change) { assert.equal(app.render().state, 'idle'); app.unmount(); }
    assert.equal(app.counts.end, 1); assert.equal(app.listeners.size, 0); assert.equal(app.documentListeners.size, 0);
  }
});

test('reduced motion preserves distance playback without automatic camera following; invalid route cannot start', () => {
  const app = mountPreview(true); app.render().play(); app.advance(6000);
  assert.ok(app.markers[0].coordinate[0] > 127); assert.equal(app.counts.follow, 0);
  app.render().finish();
  const result = app.render({ metrics: motion.buildRouteMetrics([]) });
  assert.equal(result.available, false); result.play(); assert.equal(app.frames.size, 0);
  assert.equal(app.counts.start, 1); app.unmount();
});
