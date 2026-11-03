import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LngLatBounds, Marker, type GeoJSONSource, type MapLibreMap, type PaddingOptions } from "maplibre-gl";
import BaseMap, { type MapRoute } from "../map/BaseMap";
import { DistanceBubble, SpotMarker } from "../map";
import { supportsTerrain } from "../map/terrain";
import type { HikeSpot, LngLat } from "../../types/hike";
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
  /** 현재 위치 위에 이동 거리 말풍선을 띄운다 */
  traveledKm?: number;
  spots?: HikeSpot[];
  filter?: SpotFilter;
  dimension?: "2D" | "3D";
  /** 값이 바뀔 때마다 현재 위치(없으면 경로 전체)로 지도를 맞춘다 */
  recenterKey?: number;
  /** 지도 위 상단바·시트에 가리지 않도록 경로 둘레에 둘 여백 */
  padding?: PaddingOptions;
};

const TRAVELED_COLOR = "#a6b1a9";
const REMAINING_COLOR = "#19765b";
const GPS_SOURCE_ID = "hike-gps-path";
const DEFAULT_PADDING: PaddingOptions = { top: 150, bottom: 60, left: 40, right: 70 };
const NO_SPOTS: HikeSpot[] = [];
const NO_PATH: LngLat[] = [];

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

/**
 * 등산 코스 지도: 지나온 경로(회색)·남은 경로(초록)·현재 위치·정상·스팟·이동 거리 (HIKE-02·03·05·07).
 * 배경지도·지형·오프라인 안내는 다른 화면과 같은 BaseMap을 쓴다.
 */
export function HikeRouteMap({
  route, label, mountainName, peak = route[route.length - 1], currentIndex, position, traveledPath = NO_PATH, traveledKm,
  spots = NO_SPOTS, filter = "all", dimension = "2D", recenterKey = 0, padding = DEFAULT_PADDING,
}: HikeRouteMapProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  // 지도는 경로가 바뀔 때만 새로 만든다. 여백·현재 위치는 최신 값을 ref로 읽는다.
  const paddingRef = useRef(padding);
  const currentRef = useRef<LngLat | undefined>(undefined);
  const traveledPathRef = useRef(traveledPath);
  // MapLibre Marker에 넘길 DOM 노드. React 마커 컴포넌트는 포털로 이 안에 그린다.
  const [nodes] = useState(() => ({
    spots: new Map<string, HTMLDivElement>(),
    current: document.createElement("div"),
    bubble: document.createElement("div"),
    peak: document.createElement("div"),
  }));
  spots.forEach(spot => { if (!nodes.spots.has(spot.id)) nodes.spots.set(spot.id, document.createElement("div")); });

  const current = position ?? (currentIndex === undefined ? undefined : route[currentIndex]);
  const showBubble = current !== undefined && traveledKm !== undefined;
  const terrainKey = mountainName ? TERRAIN_MOUNTAIN_KEYS[mountainName] : undefined;
  const terrainEnabled = supportsTerrain(terrainKey);

  useEffect(() => {
    paddingRef.current = padding;
    currentRef.current = current;
    traveledPathRef.current = traveledPath;
  });

  const bounds = useMemo(() => routeBounds(route).toArray() as [LngLat, LngLat], [route]);
  const routes = useMemo<MapRoute[]>(() => {
    const index = currentIndex ?? 0;
    return [
      ...(currentIndex !== undefined && index > 0
        ? [{ id: "hike-traveled", color: TRAVELED_COLOR, coordinates: route.slice(0, index + 1) }] : []),
      { id: "hike-remaining", color: REMAINING_COLOR, coordinates: route.slice(index) },
    ];
  }, [route, currentIndex]);

  const fitRoute = useCallback((target: MapLibreMap, duration: number) => {
    target.fitBounds(bounds, { padding: withSheetInset(paddingRef.current, shellRef.current), duration });
  }, [bounds]);

  // GPS 경로는 위치가 바뀔 때마다 갱신되므로 BaseMap 경로와 따로 두고 데이터만 바꾼다.
  const handleMapReady = useCallback((next: MapLibreMap | null) => {
    setMap(next);
    if (!next) return;
    next.once("load", () => {
      if (!next.getSource(GPS_SOURCE_ID)) {
        next.addSource(GPS_SOURCE_ID, { type: "geojson", data: pathData(traveledPathRef.current) });
        next.addLayer({ id: GPS_SOURCE_ID, type: "line", source: GPS_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": TRAVELED_COLOR, "line-width": 5 } });
      }
      // 생성 시점에는 컨테이너·시트 크기가 확정되지 않을 수 있어 경로 전체를 다시 맞춘다.
      next.resize();
      fitRoute(next, 0);
    });
  }, [fitRoute]);

  useEffect(() => {
    (map?.getSource(GPS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(pathData(traveledPath));
  }, [map, traveledPath]);

  // BaseMap이 코스 선을 다시 그리면 그 위로 올라오므로 GPS 경로를 다시 맨 위로 올린다.
  useEffect(() => {
    if (map?.getLayer(GPS_SOURCE_ID)) map.moveLayer(GPS_SOURCE_ID);
  }, [map, routes]);

  useEffect(() => {
    if (!map) return;
    const markers = [
      ...spots.map(spot => new Marker({ element: nodes.spots.get(spot.id)! }).setLngLat(spot.position)),
      ...(peak ? [new Marker({ element: nodes.peak, anchor: "left", offset: [-5, 0] }).setLngLat(peak)] : []),
    ];
    markers.forEach(marker => marker.addTo(map));
    return () => markers.forEach(marker => marker.remove());
  }, [map, spots, peak, nodes]);

  const currentLng = current?.[0];
  const currentLat = current?.[1];
  useEffect(() => {
    if (!map || currentLng === undefined || currentLat === undefined) return;
    const markers = [new Marker({ element: nodes.current }).setLngLat([currentLng, currentLat])];
    if (showBubble) markers.push(new Marker({ element: nodes.bubble, anchor: "bottom", offset: [-10, -14] }).setLngLat([currentLng, currentLat]));
    markers.forEach(marker => marker.addTo(map));
    return () => markers.forEach(marker => marker.remove());
  }, [map, currentLng, currentLat, showBubble, nodes]);

  // 지형이 없는 산은 BaseMap이 기울기를 다루지 않으므로 직접 기울인다.
  useEffect(() => {
    if (!terrainEnabled) map?.easeTo({ pitch: dimension === "3D" ? 60 : 0, duration: 400 });
  }, [map, dimension, terrainEnabled]);

  // 버튼을 누를 때만 맞춘다. 현재 위치가 바뀔 때마다 지도를 옮기지 않는다.
  useEffect(() => {
    if (recenterKey === 0 || !map) return;
    const target = currentRef.current;
    if (target) map.easeTo({ center: target, zoom: 16, duration: 400 });
    else fitRoute(map, 400);
  }, [recenterKey, map, fitRoute]);

  const visibleSpots = spots.filter(spot => filter === "all" || spot.kind === filter);

  return <div ref={shellRef} className="hike-route-map">
    <BaseMap className="hike-route-map__base" ariaLabel={label} bounds={bounds} routes={routes}
      showNavigationControl={false} onMapReady={handleMapReady}
      terrainMode={terrainEnabled ? dimension : undefined} />
    {visibleSpots.map(spot => createPortal(
      <SpotMarker kind={spot.kind} aria-label={spot.name} />, nodes.spots.get(spot.id)!, spot.id))}
    {createPortal(<span className="hike-route-map__peak"><span aria-hidden="true" />정상</span>, nodes.peak)}
    {current && createPortal(<span className="hike-route-map__current" role="img" aria-label="현재 위치" />, nodes.current)}
    {current && traveledKm !== undefined && createPortal(<DistanceBubble label={`${traveledKm.toFixed(1)} km`}
      aria-label={`지금까지 ${traveledKm.toFixed(1)} km 이동`} />, nodes.bubble)}
  </div>;
}
