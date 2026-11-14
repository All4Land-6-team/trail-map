import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LngLatBounds, Marker, type GeoJSONSource, type MapLibreMap, type PaddingOptions } from "maplibre-gl";
import BaseMap, { type MapRoute } from "../map/BaseMap";
import { CurrentLocationMarker, DistanceBubble, SpotMarker } from "../map";
import { supportsTerrain, type TerrainStatus } from "../map/terrain";
import type { HikeSpot, LngLat } from "../../types/hike";
import { buildHikeRouteSegments, COURSE_ROUTE_COLOR, GRAY_ROUTE_COLOR, hikeRouteColors } from "./hikeRouteSegments";
import { cameraForTwoPoints, chaikinSmooth, NAVIGATION_FAR_METERS, navigationFix, progressOnSmoothRoute, smoothLine, splitRouteAt } from "../../utils/hikeNavigation";
import { NavigationArrowMarker } from "./NavigationArrowMarker";
import "./hike.css";

export type SpotFilter = "all" | HikeSpot["kind"] | "other";

export type HikeRouteMapProps = {
  /** 진행 방향 순서의 코스 좌표 */
  route: LngLat[];
  /** 지도 이름 (스크린 리더용) */
  label: string;
  /** 산 이름. 지형 데이터가 있는 산이면 3D 지형·음영을 켠다 */
  mountainName?: string;
  /** 정상 위치. 없으면 경로 끝점 */
  peak?: LngLat;
  /** 현재 위치의 route 순번. 없으면 경로 전체를 남은 경로(초록)로 그리고 현재 위치를 표시하지 않는다. */
  currentIndex?: number;
  /** GPS로 받은 현재 위치. 있으면 currentIndex 대신 이 위치에 현재 위치를 표시한다. */
  position?: LngLat;
  /** GPS로 실제 이동한 경로. 코스 위에 지나온 경로 색으로 겹쳐 그린다. */
  traveledPath?: LngLat[];
  /** 현재 진행 방향의 코스 시작점부터 이동한 거리 */
  progressMeters?: number;
  /** 등산은 지난 구간을 회색으로, 하산은 돌아온 구간을 원래 색으로 표시한다. */
  stage?: "ascent" | "descent";
  /** 현재 위치 위에 이동 거리 말풍선을 띄운다 */
  traveledKm?: number;
  spots?: HikeSpot[];
  filter?: SpotFilter;
  dimension?: "2D" | "3D";
  /** 값이 바뀔 때마다 현재 위치(없으면 경로 전체)로 지도를 맞춘다 */
  recenterKey?: number;
  /** 지도 위 상단바·시트에 가리지 않도록 경로 둘레에 둘 여백 */
  padding?: PaddingOptions;
  /**
   * 3D일 때 길찾기 내비처럼 현재 위치를 따라간다: 지도를 기울이고 진행 방향을 위로 돌리고,
   * 앞으로 갈 경로를 강조하고, 현재 위치를 진행 방향 화살표로 그린다.
   * 지도를 손으로 움직이면 따라가기를 멈추고, recenterKey가 바뀌거나 3D로 바꾸면 다시 따라간다.
   */
  navigation?: boolean;
};

const GPS_SOURCE_ID = "hike-gps-path";
const NAV_AHEAD_SOURCE_ID = "hike-nav-ahead";
const NAV_AHEAD_CASING_ID = "hike-nav-ahead-casing";
/** 차량 내비처럼 현재 위치 뒤에서 낮게 깔려 앞을 길게 보는 각도. MapLibre 기본 최대(60°)보다 커서 최대 기울기를 올린다. */
const NAV_PITCH = 70;
const NAV_MAX_PITCH = 80;
const NAV_ZOOM = 17.5;
/** 현재 위치를 화면 아래쪽에 두어 앞쪽 경로를 넓게 보여 준다 (지도 높이 대비 위쪽 여백 비율) */
const NAV_TOP_PADDING_RATIO = 0.55;
/** 등산을 시작하면 직전 화면의 시점에서 내비 시점으로 옮겨 가는 시간 */
const NAV_INTRO_MS = 2200;
/** 직전 화면의 시점을 이어받는 최대 경과 시간 */
const CAMERA_HANDOFF_MS = 2 * 60_000;
const NO_PADDING: PaddingOptions = { top: 0, bottom: 0, left: 0, right: 0 };
const DEFAULT_PADDING: PaddingOptions = { top: 150, bottom: 60, left: 40, right: 70 };
const NO_SPOTS: HikeSpot[] = [];
const NO_PATH: LngLat[] = [];
const FOLLOW_STOP_EVENTS = ["dragstart", "rotatestart", "pitchstart", "zoomstart"] as const;

/** 지형 타일이 있는 산 (BaseMap 지형 키). 내 등산 데이터에는 산 키가 없어 이름으로 찾는다. */
const TERRAIN_MOUNTAIN_KEYS: Readonly<Record<string, string>> = { 북한산: "bukhansan", 도봉산: "dobongsan" };

/** 점이 두 개 미만이면 선을 만들 수 없어 빈 데이터로 둔다 */
function pathData(coordinates: LngLat[]) {
  return coordinates.length < 2
    ? { type: "FeatureCollection" as const, features: [] }
    : { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates } };
}

function routeBounds(route: LngLat[]) {
  return route.reduce((bounds, point) => bounds.extend(point), new LngLatBounds(route[0], route[0]));
}

/** 지도 위에 겹친 하단 시트(useDraggableSheet)가 가리는 높이만큼 아래 여백을 더한다 */
function withSheetInset(padding: PaddingOptions, container: HTMLElement | null): PaddingOptions {
  const inset = container ? parseFloat(getComputedStyle(container).getPropertyValue("--hike-sheet-height")) || 0 : 0;
  return { ...padding, bottom: (padding.bottom ?? 0) + inset };
}

type SavedCamera = { center: LngLat; zoom: number; pitch: number; bearing: number; padding: PaddingOptions; savedAt: number };
/**
 * 마지막으로 본 등산 지도 시점. 오늘의 등산(HIKE-03)에서 등산을 시작해 등산 중 화면으로 넘어가면
 * 새 지도를 이 시점에서 시작해 내비 시점으로 옮긴다. 2D였으면 위에서 내려다본 시점에서, 3D였으면 그 각도에서 출발한다.
 */
let lastCamera: SavedCamera | null = null;

function saveCamera(map: MapLibreMap) {
  const { lng, lat } = map.getCenter();
  lastCamera = { center: [lng, lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(),
    padding: map.getPadding(), savedAt: Date.now() };
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * 등산 코스 지도: 지나온 경로(회색)·남은 경로(초록)·현재 위치·정상·스팟·이동 거리 (HIKE-02·03·05·07).
 * 배경지도·지형·오프라인 안내는 다른 화면과 같은 BaseMap을 쓴다.
 */
export function HikeRouteMap({
  route, label, mountainName, peak = route[route.length - 1], currentIndex, position, traveledPath = NO_PATH, traveledKm,
  progressMeters, stage = "ascent", spots = NO_SPOTS, filter = "all", dimension = "2D", recenterKey = 0,
  padding = DEFAULT_PADDING, navigation = false,
}: HikeRouteMapProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  // 지도는 경로가 바뀔 때만 새로 만든다. 여백·현재 위치는 최신 값을 ref로 읽는다.
  const paddingRef = useRef(padding);
  const currentRef = useRef<LngLat | undefined>(undefined);
  const traveledPathRef = useRef(traveledPath);
  const stageRef = useRef(stage);
  const currentMarkerRef = useRef<Marker | null>(null);
  const currentMarkerVisibleRef = useRef(false);
  // MapLibre Marker에 넘길 DOM 노드. React 마커 컴포넌트는 포털로 이 안에 그린다.
  const [nodes] = useState(() => ({
    spots: new Map<string, HTMLDivElement>(),
    current: document.createElement("div"),
    bubble: document.createElement("div"),
    peak: document.createElement("div"),
  }));
  spots.forEach(spot => { if (!nodes.spots.has(spot.id)) nodes.spots.set(spot.id, document.createElement("div")); });

  const current = position ?? (currentIndex === undefined ? undefined : route[currentIndex]);
  const currentLng = current?.[0];
  const currentLat = current?.[1];
  const showBubble = current !== undefined && traveledKm !== undefined;
  const terrainKey = mountainName ? TERRAIN_MOUNTAIN_KEYS[mountainName] : undefined;
  const terrainEnabled = supportsTerrain(terrainKey);

  // 내비 모드: 진행 방향과 앞으로 갈 경로. 방향을 정할 수 없으면 직전 방향을 유지한다.
  const navigationActive = navigation && dimension === "3D" && current !== undefined;
  const [following, setFollowing] = useState(true);
  // 3D로 바꾸면 다시 따라간다 (렌더 중 이전 값과 비교해 바로 맞춘다).
  const [previousDimension, setPreviousDimension] = useState(dimension);
  if (previousDimension !== dimension) {
    setPreviousDimension(dimension);
    if (dimension === "3D") setFollowing(true);
  }
  const navigationActiveRef = useRef(navigationActive);
  const navigationRef = useRef(navigation);
  const navBearingRef = useRef(0);
  const navFarTargetRef = useRef<LngLat | undefined>(undefined);
  const navFix = useMemo(() => {
    if (!navigationActive || currentLng === undefined || currentLat === undefined) return null;
    return navigationFix(route, [currentLng, currentLat]);
  }, [navigationActive, route, currentLng, currentLat]);

  useEffect(() => {
    paddingRef.current = padding;
    currentRef.current = current;
    traveledPathRef.current = traveledPath;
    stageRef.current = stage;
    navigationActiveRef.current = navigationActive;
    navigationRef.current = navigation;
    if (navFix && navFix.bearing !== null) navBearingRef.current = navFix.bearing;
    navFarTargetRef.current = navFix && navFix.offCourseMeters > NAVIGATION_FAR_METERS ? navFix.onCourse : undefined;
  });

  const bounds = useMemo(() => routeBounds(route).toArray() as [LngLat, LngLat], [route]);
  const routeColors = hikeRouteColors(stage);
  // 선은 코스 전체를 한 번만 다듬고, 지나온·남은 경로는 다듬은 선을 잘라 쓴다. 그래야 움직여도 곡선 모양이 그대로다.
  // 남은 거리·진행 방향은 원래 좌표로 계산한다.
  const smoothRoute = useMemo(() => smoothLine(route), [route]);
  const routes = useMemo<MapRoute[]>(() => buildHikeRouteSegments(smoothRoute, stage,
    progressOnSmoothRoute(route, smoothRoute, progressMeters, currentIndex)), [route, smoothRoute, stage, progressMeters, currentIndex]);
  const navAhead = useMemo(() => navigationActive && currentLng !== undefined && currentLat !== undefined
    ? splitRouteAt(smoothRoute, [currentLng, currentLat]).ahead : undefined, [navigationActive, smoothRoute, currentLng, currentLat]);

  const [layersReady, setLayersReady] = useState(false);
  const fitRoute = useCallback((target: MapLibreMap, duration: number) => {
    target.fitBounds(bounds, { padding: withSheetInset(paddingRef.current, shellRef.current), duration });
  }, [bounds]);

  // GPS 경로는 위치가 바뀔 때마다 갱신되므로 BaseMap 경로와 따로 두고 데이터만 바꾼다.
  const handleMapReady = useCallback((next: MapLibreMap | null) => {
    setMap(next);
    if (!next) return;
    next.once("load", () => {
      if (!next.getSource(NAV_AHEAD_SOURCE_ID)) {
        // 내비 모드에서 앞으로 갈 경로: 흰 테두리 위에 굵은 선. 내비 모드가 아니면 숨긴다.
        next.addSource(NAV_AHEAD_SOURCE_ID, { type: "geojson", data: pathData(NO_PATH) });
        next.addLayer({ id: NAV_AHEAD_CASING_ID, type: "line", source: NAV_AHEAD_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
          paint: { "line-color": "#ffffff", "line-width": 13, "line-opacity": 0.95 } });
        next.addLayer({ id: NAV_AHEAD_SOURCE_ID, type: "line", source: NAV_AHEAD_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
          paint: { "line-color": hikeRouteColors(stageRef.current).pending, "line-width": 8 } });
      }
      if (!next.getSource(GPS_SOURCE_ID)) {
        next.addSource(GPS_SOURCE_ID, { type: "geojson", data: pathData(chaikinSmooth(traveledPathRef.current)) });
        next.addLayer({ id: GPS_SOURCE_ID, type: "line", source: GPS_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": stageRef.current === "descent" ? COURSE_ROUTE_COLOR : GRAY_ROUTE_COLOR, "line-width": 5 } });
      }
      // 생성 시점에는 컨테이너·시트 크기가 확정되지 않을 수 있어 경로 전체를 다시 맞춘다.
      next.resize();
      if (navigationRef.current) {
        // 내비 화면은 직전 화면의 시점(없으면 위에서 내려다본 경로 전체)에서 시작해 내비 시점으로 옮겨 간다.
        next.setMaxPitch(NAV_MAX_PITCH);
        const saved = lastCamera && Date.now() - lastCamera.savedAt < CAMERA_HANDOFF_MS ? lastCamera : null;
        if (saved) next.jumpTo(saved);
        else fitRoute(next, 0);
      } else fitRoute(next, 0);
      next.on("moveend", () => saveCamera(next));
      // 내비 경로를 그릴 레이어가 생겼으니 효과를 다시 돌린다.
      setLayersReady(true);
    });
  }, [fitRoute]);

  // 지나온 GPS 경로는 모서리 깎기만 한다. 이 방식은 앞부분 모양이 새 위치에 따라 바뀌지 않는다.
  const smoothTraveledPath = useMemo(() => chaikinSmooth(traveledPath), [traveledPath]);
  useEffect(() => {
    (map?.getSource(GPS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(pathData(smoothTraveledPath));
  }, [map, smoothTraveledPath, layersReady]);

  useEffect(() => {
    if (map?.getLayer(GPS_SOURCE_ID)) {
      map.setPaintProperty(GPS_SOURCE_ID, "line-color", routeColors.completed);
    }
    // 내비 모드에서 강조하는 앞쪽 경로도 진행 단계의 남은 구간 색을 따른다(등산 초록, 하산 회색).
    if (map?.getLayer(NAV_AHEAD_SOURCE_ID)) {
      map.setPaintProperty(NAV_AHEAD_SOURCE_ID, "line-color", routeColors.pending);
    }
  }, [map, routeColors.completed, routeColors.pending, layersReady]);

  // BaseMap이 코스 선을 다시 그리면 그 위로 올라오므로 내비 경로·GPS 경로를 다시 맨 위로 올린다.
  useEffect(() => {
    [NAV_AHEAD_CASING_ID, NAV_AHEAD_SOURCE_ID, GPS_SOURCE_ID].forEach(id => { if (map?.getLayer(id)) map.moveLayer(id); });
  }, [map, routes, layersReady]);

  useEffect(() => {
    if (!map?.getLayer(NAV_AHEAD_SOURCE_ID)) return;
    const visibility = navAhead && navAhead.length >= 2 ? "visible" : "none";
    [NAV_AHEAD_CASING_ID, NAV_AHEAD_SOURCE_ID].forEach(id => map.setLayoutProperty(id, "visibility", visibility));
    (map.getSource(NAV_AHEAD_SOURCE_ID) as GeoJSONSource | undefined)?.setData(pathData(navAhead ?? NO_PATH));
  }, [map, navAhead, layersReady]);

  // 손으로 끌기·돌리기·기울이기·확대하면 따라가기를 멈춘다. 코드로 옮길 때는 originalEvent가 없다.
  useEffect(() => {
    if (!map || !navigationActive) return;
    const stop = (event: { originalEvent?: unknown }) => { if (event.originalEvent) setFollowing(false); };
    FOLLOW_STOP_EVENTS.forEach(name => map.on(name, stop));
    return () => FOLLOW_STOP_EVENTS.forEach(name => map.off(name, stop));
  }, [map, navigationActive]);

  const followCamera = useCallback((target: MapLibreMap, center: LngLat, duration: number) => {
    const height = target.getContainer().clientHeight;
    // 화면이 넘겨준 아래 여백(하단 HUD·시트)만큼 비워 현재 위치가 가리지 않게 한다.
    const bottom = withSheetInset({ bottom: paddingRef.current.bottom ?? 0 }, shellRef.current).bottom ?? 0;
    const animation = { bearing: navBearingRef.current, pitch: NAV_PITCH,
      duration: prefersReducedMotion() ? 0 : duration, essential: true };
    // 코스에서 멀리 벗어나면 현재 위치와 가장 가까운 코스 지점을 함께 보여 준다.
    const onCourse = navFarTargetRef.current;
    if (onCourse) {
      // 기울이고 돌린 지도에서는 fitBounds가 맞추지 못해 중심·확대 수준을 직접 구한다.
      const padding = { top: 150, bottom: bottom + 16, left: 40, right: 70 };
      const width = target.getContainer().clientWidth;
      const available = Math.min(width - padding.left - padding.right, height - padding.top - padding.bottom);
      target.easeTo({ ...animation, ...cameraForTwoPoints(center, onCourse, available, NAV_ZOOM), padding });
      return;
    }
    target.easeTo({ ...animation, center, zoom: NAV_ZOOM,
      padding: { top: Math.min(height * NAV_TOP_PADDING_RATIO, Math.max(0, height - bottom - 80)), bottom, left: 0, right: 0 } });
  }, []);

  // 위치를 받을 때마다 내비 카메라를 옮긴다. 처음 한 번은 직전 시점에서 내비 시점으로 천천히 옮겨 가고,
  // 옮겨 가는 동안 들어온 위치로는 끊지 않는다(끝나면 다음 위치에서 따라잡는다).
  const introRef = useRef({ pending: true, until: 0 });
  useEffect(() => {
    if (!map || !layersReady || !navigationActive || !following || currentLng === undefined || currentLat === undefined) return;
    const intro = introRef.current;
    if (intro.pending) {
      intro.pending = false;
      intro.until = Date.now() + NAV_INTRO_MS;
      followCamera(map, [currentLng, currentLat], NAV_INTRO_MS);
      return;
    }
    if (Date.now() < intro.until) return;
    followCamera(map, [currentLng, currentLat], 900);
  }, [map, navigationActive, following, currentLng, currentLat, navFix, followCamera, layersReady]);

  // 3D 지형이 켜지면 MapLibre가 카메라 높이를 유지하려고 확대 수준을 바꾸므로 내비 카메라를 다시 맞춘다.
  useEffect(() => {
    if (!map || !navigationActive || !following) return;
    const refollow = () => {
      const target = currentRef.current;
      if (!target) return;
      // 시작 전환 중이면 남은 시간만큼 이어서 옮긴다.
      const remaining = introRef.current.until - Date.now();
      followCamera(map, target, remaining > 0 ? remaining : 0);
    };
    map.on("terrain", refollow);
    return () => { map.off("terrain", refollow); };
  }, [map, navigationActive, following, followCamera]);

  // 지형 타일을 하나라도 못 받으면 BaseMap이 지형을 끄고 기울기를 0으로 되돌린다.
  // 내비 모드는 평평한 지도에서도 같은 시점을 유지하도록 그 뒤에 내비 카메라를 다시 맞춘다.
  const followingRef = useRef(following);
  useEffect(() => { followingRef.current = following; }, [following]);
  const handleTerrainStatus = useCallback((status: TerrainStatus) => {
    const target = currentRef.current;
    if (status !== "error" || !map || !target || !navigationActiveRef.current || !followingRef.current) return;
    const remaining = introRef.current.until - Date.now();
    followCamera(map, target, Math.max(400, remaining));
  }, [map, followCamera]);

  // 내비 모드를 끄면(2D) 북쪽을 위로 되돌리고 경로 전체를 보여 준다.
  const wasNavigatingRef = useRef(false);
  useEffect(() => {
    if (!map) return;
    if (wasNavigatingRef.current && !navigationActive) {
      map.easeTo({ bearing: 0, pitch: 0, padding: NO_PADDING, duration: 0 });
      fitRoute(map, prefersReducedMotion() ? 0 : 400);
    }
    wasNavigatingRef.current = navigationActive;
  }, [map, navigationActive, fitRoute]);

  useEffect(() => {
    if (!map) return;
    const markers = [
      ...spots.map(spot => new Marker({ element: nodes.spots.get(spot.id)! }).setLngLat(spot.position)),
      ...(peak ? [new Marker({ element: nodes.peak, anchor: "left", offset: [-5, 0] }).setLngLat(peak)] : []),
    ];
    markers.forEach(marker => marker.addTo(map));
    return () => markers.forEach(marker => marker.remove());
  }, [map, spots, peak, nodes]);

  useEffect(() => {
    if (!map) return;
    // 내비 모드 화살표는 지도 방위에 맞춰 돌려 진행 방향을 가리키고, 기울어진 지도에서도 납작해지지 않게 화면을 향한다.
    const marker = navigationActive
      ? new Marker({ element: nodes.current, rotationAlignment: "map", pitchAlignment: "viewport", opacityWhenCovered: "1" })
      : new Marker({ element: nodes.current });
    currentMarkerRef.current = marker;
    return () => {
      marker.remove();
      if (currentMarkerRef.current === marker) currentMarkerRef.current = null;
      currentMarkerVisibleRef.current = false;
    };
  }, [map, nodes, navigationActive]);

  useEffect(() => {
    const marker = currentMarkerRef.current;
    if (!map || !marker || currentLng === undefined || currentLat === undefined) {
      if (currentMarkerVisibleRef.current) marker?.remove();
      currentMarkerVisibleRef.current = false;
      return;
    }
    marker.setLngLat([currentLng, currentLat]);
    if (navigationActive) marker.setRotation(navBearingRef.current);
    if (!currentMarkerVisibleRef.current) {
      marker.addTo(map);
      currentMarkerVisibleRef.current = true;
    }
  }, [map, currentLng, currentLat, navigationActive, navFix]);

  useEffect(() => {
    if (!map || currentLng === undefined || currentLat === undefined || !showBubble) return;
    const marker = new Marker({ element: nodes.bubble, anchor: "bottom", offset: [-10, -14] })
      .setLngLat([currentLng, currentLat]).addTo(map);
    return () => { marker.remove(); };
  }, [map, currentLng, currentLat, showBubble, nodes]);

  // 지형이 없는 산은 BaseMap이 기울기를 다루지 않으므로 직접 기울인다. 내비 모드는 내비 카메라가 다룬다.
  useEffect(() => {
    if (!terrainEnabled && !navigationActive) map?.easeTo({ pitch: dimension === "3D" ? 60 : 0, duration: 400 });
  }, [map, dimension, terrainEnabled, navigationActive]);

  // 버튼을 누를 때만 맞춘다. 내비 모드가 아니면 현재 위치가 바뀔 때마다 지도를 옮기지 않는다.
  useEffect(() => {
    if (recenterKey === 0 || !map) return;
    const target = currentRef.current;
    if (navigationActiveRef.current && target) {
      setFollowing(true);
      followCamera(map, target, 400);
    } else if (target) map.easeTo({ center: target, zoom: 16, duration: 400 });
    else fitRoute(map, 400);
  }, [recenterKey, map, fitRoute, followCamera]);

  const visibleSpots = spots.filter(spot => filter === "all" || spot.kind === filter);

  return <div ref={shellRef} className="hike-route-map">
    <BaseMap className="hike-route-map__base" ariaLabel={label} bounds={bounds} routes={routes}
      showNavigationControl={false} onMapReady={handleMapReady}
      terrainMode={terrainEnabled ? dimension : undefined} terrainCameraManaged={navigationActive}
      onTerrainStatusChange={handleTerrainStatus} />
    {visibleSpots.map(spot => createPortal(
      <SpotMarker kind={spot.kind} aria-label={spot.name} />, nodes.spots.get(spot.id)!, spot.id))}
    {createPortal(<span className="hike-route-map__peak"><span aria-hidden="true" />정상</span>, nodes.peak)}
    {current && createPortal(navigationActive ? <NavigationArrowMarker /> : <CurrentLocationMarker />, nodes.current)}
    {current && traveledKm !== undefined && createPortal(<DistanceBubble label={`${traveledKm.toFixed(1)} km`}
      aria-label={`지금까지 ${traveledKm.toFixed(1)} km 이동`} />, nodes.bubble)}
  </div>;
}
