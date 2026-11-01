import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Marker, type MapLibreMap } from 'maplibre-gl';
import { interpolateBearing, sampleRouteAt, type RouteMetrics } from '../../utils/courseRouteMotion';
import { createPreviewClock, measureMapPadding } from './routeMapCamera';
import { ENHANCED_ROUTE_LINE, reducedRouteMotion } from './useEnhancedCourseRoute';

type PreviewState = 'idle' | 'playing' | 'paused';
type Options = {
  map: MapLibreMap | null;
  enabled: boolean;
  courseId?: string;
  metrics: RouteMetrics;
  activeSlot: RefObject<number>;
  onStart?: () => void;
  onEnd?: () => void;
  fitWhole: () => void;
  interruptCamera: () => void;
};

/** Playback owns only its marker/gradient/RAF; the page owns sheet restoration. */
export function useCourseRoutePreview({ map, enabled, courseId, metrics, activeSlot, onStart, onEnd, fitWhole, interruptCamera }: Options) {
  const [state, setState] = useState<PreviewState>('idle');
  const stateRef = useRef<PreviewState>('idle');
  const frame = useRef(0);
  const marker = useRef<Marker | null>(null);
  const clock = useRef(createPreviewClock(12000));
  const callbacks = useRef({ onStart, onEnd, fitWhole, interruptCamera });
  useEffect(() => { callbacks.current = { onStart, onEnd, fitWhole, interruptCamera }; }, [onStart, onEnd, fitWhole, interruptCamera]);

  const finish = useCallback((overview = true) => {
    const wasActive = stateRef.current !== 'idle';
    stateRef.current = 'idle';
    cancelAnimationFrame(frame.current);
    clock.current.reset();
    marker.current?.remove(); marker.current = null;
    if (map) {
      if (wasActive) map.stop();
      for (const slot of [0, 1]) if (map.getLayer(`${ENHANCED_ROUTE_LINE}${slot}`)) {
        map.setPaintProperty(`${ENHANCED_ROUTE_LINE}${slot}`, 'line-gradient', undefined);
      }
    }
    setState('idle');
    if (wasActive) {
      callbacks.current.onEnd?.();
      if (overview) callbacks.current.fitWhole();
    }
  }, [map]);

  const pause = useCallback((stopCamera = true) => {
    if (stateRef.current !== 'playing') return;
    clock.current.pause(performance.now());
    stateRef.current = 'paused'; setState('paused');
    cancelAnimationFrame(frame.current);
    // Gestures already cancel camera easing; stop() would also reset their handlers.
    if (stopCamera) map?.stop();
  }, [map]);

  const play = useCallback(() => {
    if (!enabled || !map || !metrics.valid || stateRef.current === 'playing') return;
    const first = stateRef.current === 'idle';
    if (first) {
      callbacks.current.interruptCamera();
      callbacks.current.onStart?.();
      const element = document.createElement('div');
      element.className = 'course-route-preview-point'; element.setAttribute('aria-label', '코스 둘러보기 위치');
      marker.current = new Marker({ element, pitchAlignment: 'viewport', rotationAlignment: 'viewport', opacityWhenCovered: 0 })
        .setLngLat([...metrics.coordinates[0]]).addTo(map);
    }
    stateRef.current = 'playing'; setState('playing');
    clock.current.play(performance.now());
    let lastCamera = 0, bearing = map.getBearing();
    const tick = (now: number) => {
      if (stateRef.current !== 'playing') return;
      const progress = clock.current.progress(now);
      const sample = sampleRouteAt(metrics, progress * metrics.totalMeters);
      if (!sample) { finish(); return; }
      marker.current?.setLngLat(sample.coordinate);
      const layer = `${ENHANCED_ROUTE_LINE}${activeSlot.current}`;
      if (map.getLayer(layer)) map.setPaintProperty(layer, 'line-gradient',
        ['step', ['line-progress'], '#66c6ad', Math.max(.00001, progress), '#087F72']);
      if (!reducedRouteMotion() && now - lastCamera >= 120) {
        const ahead = sampleRouteAt(metrics, Math.min(1, progress + .025) * metrics.totalMeters);
        const padding = measureMapPadding(map, 0);
        bearing = interpolateBearing(bearing, ahead?.bearing ?? sample.bearing, .12);
        map.easeTo({ center: ahead?.coordinate ?? sample.coordinate, bearing, pitch: 45,
          zoom: Math.max(13, Math.min(14.5, map.getZoom())),
          offset: [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2], duration: 240 });
        lastCamera = now;
      }
      if (progress >= 1) { finish(); return; }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [enabled, map, metrics, activeSlot, finish]);

  useEffect(() => {
    if (!map) return;
    const gesture = (event: { originalEvent?: unknown }) => { if (event.originalEvent) pause(false); };
    const visibility = () => { if (document.hidden) pause(); };
    map.on('dragstart', gesture); map.on('zoomstart', gesture); map.on('rotatestart', gesture); map.on('pitchstart', gesture);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      map.off('dragstart', gesture); map.off('zoomstart', gesture); map.off('rotatestart', gesture); map.off('pitchstart', gesture);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [map, pause]);

  useEffect(() => {
    // Selection, dimension, availability or page changes invalidate every previous callback.
    return () => finish(false);
  }, [courseId, enabled, metrics, finish]);

  const visibleState = enabled ? state : 'idle';
  return { state: visibleState as PreviewState, play, pause, finish, available: enabled && metrics.valid };
}
