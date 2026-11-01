import test from 'node:test';
import assert from 'node:assert/strict';
import { safeMapPadding, pointsFitSafeArea, createPreviewClock, shouldFitCourse, routeFadeOpacity, recoverRouteTerrain } from '../src/components/map/routeMapCamera.ts';

test('terrain failure cancels playback before starting the final 2D recovery camera', () => {
  const events = [];
  recoverRouteTerrain({ easeTo: options => events.push(['pitch', options.pitch]) },
    () => events.push(['preview', 'stopped']), mode => events.push(['mode', mode]), false);
  assert.deepEqual(events, [['preview', 'stopped'], ['mode', '2D'], ['pitch', 0]]);
});

test('RAF timestamp may precede performance.now but both fade opacities remain within bounds', () => {
  assert.deepEqual(routeFadeOpacity(99, 110, .4), { incoming: 0, outgoing: .4 });
  assert.deepEqual(routeFadeOpacity(410, 110, .4), { incoming: 1, outgoing: 0 });
  assert.deepEqual(routeFadeOpacity(210, 110, .4), { incoming: 1 / 3, outgoing: .2 });
});

test('explicit whole-course fit does not mistake a country-wide overview for a fitted course', () => {
  assert.equal(shouldFitCourse(true, true, true), true);
  assert.equal(shouldFitCourse(false, true, true), false);
  assert.equal(shouldFitCourse(false, true, false), true);
});

test('measured overlays reserve title, buttons and sheet without an invalid viewport', () => {
  const padding = safeMapPadding({ width: 390, height: 844, top: 72, right: 65, bottom: 430 });
  assert.equal(padding.top, 96);
  assert.equal(padding.right, 89);
  assert.equal(padding.bottom, 454);
  assert.equal(pointsFitSafeArea([{ x: 100, y: 150 }, { x: 200, y: 300 }], 390, 844, padding), true);
  assert.equal(pointsFitSafeArea([{ x: 100, y: 50 }], 390, 844, padding), false);
  const tiny = safeMapPadding({ width: 320, height: 480, top: 120, right: 100, bottom: 450 });
  assert.ok(tiny.top + tiny.bottom < 480);
  assert.ok(tiny.left + tiny.right < 320);
});

test('preview elapsed clock excludes pause time and caps the twelve second tour', () => {
  const clock = createPreviewClock(12000);
  clock.play(1000);
  assert.equal(clock.progress(4000), .25);
  clock.pause(4000);
  assert.equal(clock.progress(100000), .25);
  clock.play(100000);
  assert.equal(clock.progress(103000), .5);
  assert.equal(clock.progress(120000), 1);
  clock.reset();
  assert.equal(clock.progress(130000), 0);
});
