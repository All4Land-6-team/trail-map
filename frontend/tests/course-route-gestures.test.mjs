import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as motion from '../src/utils/courseRouteMotion.ts';
import * as camera from '../src/components/map/routeMapCamera.ts';

test('route camera interruption preserves ongoing drag, zoom, rotation and pitch gestures', () => {
  const effects = [], listeners = new Map();
  const map = {
    gestureActive: false, stopCount: 0,
    on(name, callback) { const callbacks = listeners.get(name) ?? []; callbacks.push(callback); listeners.set(name, callbacks); },
    off() {}, isStyleLoaded: () => false,
    // Public MapLibre Map.stop() resets handlers as well as camera easing.
    stop() { this.stopCount++; this.gestureActive = false; },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/map/useEnhancedCourseRoute.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports, require: name => name === 'react' ? {
      useRef: current => ({ current }), useMemo: fn => fn(), useCallback: fn => fn,
      useEffect: fn => effects.push(fn),
    } : name.endsWith('courseRouteMotion') ? motion : name.endsWith('routeMapCamera') ? camera : {},
    setTimeout: () => 1, clearTimeout() {}, cancelAnimationFrame() {},
  });
  exports.useEnhancedCourseRoute(map, true, null, '2D', 0);
  const cleanups = effects.map(effect => effect());
  try {
    for (const event of ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart']) {
      const callbacks = listeners.get(event);
      const before = map.stopCount;
      callbacks.forEach(callback => callback({}));
      assert.equal(map.stopCount, before, 'programmatic camera changes do not interrupt themselves');
      map.gestureActive = true;
      callbacks.forEach(callback => callback({ originalEvent: { type: 'pointermove' } }));
      assert.equal(map.stopCount, before, 'MapLibre already cancels easing before the gesture event');
      assert.equal(map.gestureActive, true, `${event} must not reset the input handler`);
    }
  } finally { cleanups.forEach(cleanup => cleanup?.()); }
});
