import type { MapLibreMap, PaddingOptions } from 'maplibre-gl';

export function recoverRouteTerrain(map: Pick<MapLibreMap, 'easeTo'> | null, stopPreview: () => void,
  setDimension: (mode: '2D') => void, reduced: boolean) {
  // Preview cleanup may stop the map; recover only after that stop, never before it.
  stopPreview();
  setDimension('2D');
  map?.easeTo({ pitch: 0, duration: reduced ? 0 : 350 });
}

export function shouldFitCourse(force: boolean, fits: boolean, pitchMatches: boolean) {
  return force || !fits || !pitchMatches;
}

export function routeFadeOpacity(now: number, started: number, previousOpacity: number) {
  const elapsed = Math.max(0, now - started);
  return { incoming: Math.min(1, elapsed / 300), outgoing: Math.min(1, Math.max(0, previousOpacity)) * Math.max(0, 1 - elapsed / 200) };
}

export function safeMapPadding({ width, height, top, right, bottom }: { width: number; height: number; top: number; right: number; bottom: number }): Required<PaddingOptions> {
  const vertical = Math.max(1, height - 80);
  const requestedTop = Math.max(24, top + 24);
  const requestedBottom = Math.max(24, bottom + 24);
  const scale = Math.min(1, vertical / (requestedTop + requestedBottom));
  return { top: requestedTop * scale, bottom: requestedBottom * scale, left: 30,
    right: Math.min(Math.max(30, right + 24), Math.max(30, width - 110)) };
}

export function measureMapPadding(map: MapLibreMap, fallbackInset: number) {
  const container = map.getContainer(), bounds = container.getBoundingClientRect();
  const root = container.closest('main');
  const rect = (selector: string) => root?.querySelector(selector)?.getBoundingClientRect();
  const title = rect('.course-page__top'), actions = rect('.course-map__actions');
  const preview = rect('.course-map__preview');
  const sheet = rect('.course-list-sheet'), nav = rect('.course-page__nav');
  const bottomEdge = Math.min(sheet?.top ?? bounds.bottom, nav?.top ?? bounds.bottom);
  return safeMapPadding({ width: bounds.width, height: bounds.height,
    top: Math.max(title ? Math.max(0, title.bottom - bounds.top) : 72, preview ? preview.bottom - bounds.top : 0),
    right: actions ? Math.max(0, bounds.right - actions.left) : 65,
    bottom: Math.max(fallbackInset, bounds.bottom - bottomEdge) });
}

export function pointsFitSafeArea(points: readonly { x: number; y: number }[], width: number, height: number, padding: Required<PaddingOptions>) {
  return points.length > 0 && points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= padding.left && point.x <= width - padding.right
    && point.y >= padding.top && point.y <= height - padding.bottom);
}

export function createPreviewClock(duration: number) {
  let elapsed = 0, started: number | null = null;
  const value = (now: number) => elapsed + (started === null ? 0 : Math.max(0, now - started));
  return {
    play(now: number) { if (started === null) started = now; },
    pause(now: number) { elapsed = value(now); started = null; },
    progress(now: number) { return Math.min(1, value(now) / duration); },
    reset() { elapsed = 0; started = null; },
  };
}
