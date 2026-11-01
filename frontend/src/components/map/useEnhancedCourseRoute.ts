import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LngLatBounds, Marker, type GeoJSONSource, type GeoJSONSourceSpecification, type MapLibreMap } from 'maplibre-gl';
import type { Course } from '../../types/course';
import type { MapDimension } from './MapAction';
import { buildRouteMetrics } from '../../utils/courseRouteMotion';
import { measureMapPadding, pointsFitSafeArea, shouldFitCourse, routeFadeOpacity } from './routeMapCamera';

export const ENHANCED_ROUTE_SOURCE = 'enhanced-route-';
export const ENHANCED_ROUTE_LINE = 'enhanced-route-line-';
const OUTLINE = 'enhanced-route-outline-';
const EMPTY: GeoJSONSourceSpecification['data'] = { type: 'FeatureCollection', features: [] };
export const reducedRouteMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useEnhancedCourseRoute(map: MapLibreMap | null, enabled: boolean, selected: Course | null,
  dimension: MapDimension, bottomInset: number) {
  const metrics = useMemo(() => buildRouteMetrics(selected?.routeCoordinates ?? []), [selected]);
  const activeSlot = useRef(0);
  const initializedMap = useRef<MapLibreMap | null>(null);
  const userMoved = useRef(false);
  const fitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitGeneration = useRef(0);
  const movingMarkers = useRef<Marker[]>([]);
  const input = useRef({ metrics, dimension, bottomInset });
  useEffect(() => { input.current = { metrics, dimension, bottomInset }; }, [metrics, dimension, bottomInset]);

  const fitWhole = useCallback((force = true) => {
    if (!map || !enabled) return;
    const state = input.current;
    if (!state.metrics.valid || (!force && userMoved.current)) return;
    if (force) userMoved.current = false;
    const generation = ++fitGeneration.current;
    if (fitTimer.current) clearTimeout(fitTimer.current);
    const padding = measureMapPadding(map, state.bottomInset);
    const container = map.getContainer();
    // MapLibre 6 adds persistent transform padding to fitBounds padding. Our camera
    // uses per-operation padding/offset only, and clears any padding left by a prior owner.
    const existingPadding = map.getPadding();
    if (Object.values(existingPadding).some(value => value > 0)) {
      const visibleCenter = map.unproject([container.clientWidth / 2, container.clientHeight / 2]);
      map.jumpTo({ center: visibleCenter, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
    }
    const fits = () => pointsFitSafeArea(state.metrics.coordinates.map(point => map.project([point[0], point[1]])),
      container.clientWidth, container.clientHeight, padding);
    const pitch = state.dimension === '3D' ? 45 : 0;
    if (!shouldFitCourse(force, fits(), Math.abs(map.getPitch() - pitch) < 1)) return;
    const bounds = new LngLatBounds();
    state.metrics.coordinates.forEach(point => bounds.extend([point[0], point[1]]));
    const duration = reducedRouteMotion() ? 0 : state.dimension === '3D' ? 700 : 600;
    map.stop();
    map.fitBounds(bounds, { padding, maxZoom: 15, pitch, bearing: map.getBearing(), duration });
    // Bounds alone do not prove a pitched terrain route is inside the visible rectangle.
    // Recheck projected coordinates after settling and make at most two small corrections.
    let attempts = 0;
    const check = () => {
      if (generation !== fitGeneration.current || userMoved.current || fits() || attempts >= 2) return;
      attempts += 1;
      map.easeTo({ zoom: map.getZoom() - .35, pitch: state.dimension === '3D' ? Math.max(30, map.getPitch() - 5) : 0,
        duration: reducedRouteMotion() ? 0 : 240 });
      fitTimer.current = setTimeout(check, 280);
    };
    fitTimer.current = setTimeout(check, duration + 100);
  }, [map, enabled]);

  useEffect(() => {
    if (!map || !enabled) return;
    const userGesture = (event: { originalEvent?: unknown }) => {
      if (!event.originalEvent) return;
      userMoved.current = true;
      fitGeneration.current += 1;
      // MapLibre already cancels camera easing when a gesture starts.
      // Calling map.stop() here would also reset the active input handler.
    };
    map.on('dragstart', userGesture); map.on('zoomstart', userGesture); map.on('rotatestart', userGesture); map.on('pitchstart', userGesture);
    let resizeTimer: ReturnType<typeof setTimeout>;
    const resize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => fitWhole(false), 180); };
    map.on('resize', resize);
    return () => {
      map.off('dragstart', userGesture); map.off('zoomstart', userGesture); map.off('rotatestart', userGesture); map.off('pitchstart', userGesture);
      map.off('resize', resize); clearTimeout(resizeTimer);
      if (fitTimer.current) clearTimeout(fitTimer.current);
      fitGeneration.current += 1;
    };
  }, [map, enabled, fitWhole]);

  useEffect(() => {
    if (!map || !enabled) return;
    userMoved.current = false;
    const fit = () => {
      fitWhole(initializedMap.current !== map);
      initializedMap.current = map;
    };
    map.on('load', fit);
    const timer = setTimeout(fit, 40);
    return () => {
      clearTimeout(timer); map.off('load', fit); fitGeneration.current += 1;
      if (fitTimer.current) clearTimeout(fitTimer.current);
    };
  }, [map, enabled, selected, dimension, fitWhole]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => fitWhole(false), 180);
    return () => clearTimeout(timer);
  }, [enabled, bottomInset, fitWhole]);

  useEffect(() => {
    if (!map || !enabled) return;
    let frame = 0, disposed = false, rendered = false;
    let outgoingMarkers: Marker[] = [];
    const render = () => {
      if (disposed || rendered || !map.isStyleLoaded()) return;
      rendered = true;
      const next = (activeSlot.current + 1) % 2, previous = activeSlot.current;
      activeSlot.current = next;
      for (const slot of [0, 1]) {
        const source = `${ENHANCED_ROUTE_SOURCE}${slot}`;
        if (!map.getSource(source)) {
          map.addSource(source, { type: 'geojson', data: EMPTY, lineMetrics: true });
          map.addLayer({ id: `${OUTLINE}${slot}`, source, type: 'line', layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#fff', 'line-width': 6.5, 'line-opacity': 0, 'line-opacity-transition': { duration: 0 } } });
          map.addLayer({ id: `${ENHANCED_ROUTE_LINE}${slot}`, source, type: 'line', layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#087F72', 'line-width': 4, 'line-opacity': 0, 'line-opacity-transition': { duration: 0 } } });
        }
        map.setPaintProperty(`${ENHANCED_ROUTE_LINE}${slot}`, 'line-gradient', undefined);
        map.setPaintProperty(`${ENHANCED_ROUTE_LINE}${slot}`, 'line-width', ['interpolate', ['linear'], ['zoom'], 10, 3, 14, dimension === '3D' ? 4.5 : 4, 18, 5]);
        map.setPaintProperty(`${OUTLINE}${slot}`, 'line-width', ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 6.5, 18, 7.5]);
        map.setPaintProperty(`${OUTLINE}${slot}`, 'line-blur', dimension === '3D' ? .6 : 0);
      }
      const previousOpacity = Number(map.getPaintProperty(`${ENHANCED_ROUTE_LINE}${previous}`, 'line-opacity')) || 0;
      map.setPaintProperty(`${ENHANCED_ROUTE_LINE}${next}`, 'line-opacity', 0);
      map.setPaintProperty(`${OUTLINE}${next}`, 'line-opacity', 0);
      (map.getSource(`${ENHANCED_ROUTE_SOURCE}${next}`) as GeoJSONSource).setData(metrics.valid
        ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: metrics.coordinates.map(point => [...point]) } } : EMPTY);
      const oldMarkers = movingMarkers.current;
      outgoingMarkers = oldMarkers;
      const newMarkers: Marker[] = [];
      movingMarkers.current = newMarkers;
      const endpoint = (coordinate: readonly [number, number], kind: string, label: string) => {
        const element = document.createElement('div');
        element.className = `course-route-endpoint course-route-endpoint--${kind}`;
        const symbol = document.createElement('span'); symbol.className = 'course-route-endpoint__symbol';
        symbol.textContent = kind === 'finish' ? '⚑' : '';
        const text = document.createElement('span'); text.className = 'course-route-endpoint__label'; text.textContent = label;
        element.append(symbol, text); element.setAttribute('aria-label', label);
        const marker = new Marker({ element, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport', opacityWhenCovered: 0 })
          .setLngLat([coordinate[0], coordinate[1]]).addTo(map);
        newMarkers.push(marker);
      };
      if (metrics.valid) {
        endpoint(metrics.coordinates[0], 'start', metrics.closed ? '출발·도착' : '출발');
        if (!metrics.closed) endpoint(metrics.coordinates.at(-1)!, 'finish', '도착');
      }
      const reduced = reducedRouteMotion(), started = performance.now();
      const tick = (now: number) => {
        if (disposed) return;
        const { incoming, outgoing } = reduced ? { incoming: 1, outgoing: 0 } : routeFadeOpacity(now, started, previousOpacity);
        for (const [slot, opacity] of [[next, incoming], [previous, outgoing]]) {
          map.setPaintProperty(`${ENHANCED_ROUTE_LINE}${slot}`, 'line-opacity', opacity);
          map.setPaintProperty(`${OUTLINE}${slot}`, 'line-opacity', opacity * (dimension === '3D' ? .65 : .95));
        }
        newMarkers.forEach(marker => marker.setOpacity(incoming, 0));
        oldMarkers.forEach(marker => marker.setOpacity(outgoing, 0));
        if (incoming < 1) frame = requestAnimationFrame(tick);
        else { oldMarkers.forEach(marker => marker.remove()); (map.getSource(`${ENHANCED_ROUTE_SOURCE}${previous}`) as GeoJSONSource).setData(EMPTY); }
      };
      frame = requestAnimationFrame(tick);
    };
    map.on('load', render); map.on('idle', render); render();
    return () => {
      disposed = true; cancelAnimationFrame(frame); map.off('load', render); map.off('idle', render);
      // A rapid switch may interrupt the previous fade; remove every previous marker immediately.
      outgoingMarkers.forEach(marker => marker.remove());
    };
  }, [map, enabled, selected, dimension, metrics]);

  useEffect(() => () => {
    movingMarkers.current.forEach(marker => marker.remove()); movingMarkers.current = [];
  }, [map, enabled]);

  const interruptCamera = useCallback(() => {
    userMoved.current = true;
    fitGeneration.current += 1;
    if (fitTimer.current) clearTimeout(fitTimer.current);
    map?.stop();
  }, [map]);
  return { metrics, fitWhole, activeSlot, interruptCamera };
}
