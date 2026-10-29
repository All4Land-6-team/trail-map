import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LngLatBounds, MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type PaddingOptions } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { DistanceBubble, SpotMarker } from "../map";
import { BASE_MAP_STYLE_URL, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from "../../constants/map";
import { limitMapToSouthKorea } from "../../utils/mapZoom";
import type { HikeSpot, LngLat } from "../../types/hike";
import "./hike.css";

setWorkerUrl(workerUrl);

export type SpotFilter = "all" | HikeSpot["kind"] | "other";

export type HikeRouteMapProps = {
  /** 진행 방향 순서의 코스 좌표 */
  route: LngLat[];
  /** 지도 이름 (스크린 리더용) */
  label: string;
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
const DEFAULT_PADDING: PaddingOptions = { top: 150, bottom: 60, left: 40, right: 70 };
const NO_SPOTS: HikeSpot[] = [];
const NO_PATH: LngLat[] = [];

function lineFeature(coordinates: LngLat[]) {
  return { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates } };
}

/** 점이 두 개 미만이면 선을 만들 수 없어 빈 데이터로 둔다 */
function pathData(coordinates: LngLat[]) {
  return coordinates.length < 2 ? { type: "FeatureCollection" as const, features: [] } : lineFeature(coordinates);
}

function routeBounds(route: LngLat[]) {
  return route.reduce((bounds, point) => bounds.extend(point), new LngLatBounds(route[0], route[0]));
}

/** 지도 위에 겹친 하단 시트(useDraggableSheet)가 가리는 높이만큼 아래 여백을 더한다 */
function withSheetInset(padding: PaddingOptions, container: HTMLElement | null): PaddingOptions {
  const inset = container ? parseFloat(getComputedStyle(container).getPropertyValue("--hike-sheet-height")) || 0 : 0;
  return { ...padding, bottom: (padding.bottom ?? 0) + inset };
}

/** 등산 코스 지도: 지나온 경로(회색)·남은 경로(초록)·현재 위치·정상·스팟·이동 거리 (HIKE-02·03·05·07) */
export function HikeRouteMap({
  route, label, peak = route[route.length - 1], currentIndex, position, traveledPath = NO_PATH, traveledKm, spots = NO_SPOTS,
  filter = "all", dimension = "2D", recenterKey = 0, padding = DEFAULT_PADDING,
}: HikeRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // 위치가 바뀔 때마다 지도를 다시 만들지 않도록 현재 위치·이동 경로는 지도와 따로 갱신한다.
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const traveledPathRef = useRef(traveledPath);
  const [hasLoadError, setHasLoadError] = useState(false);
  // MapLibre Marker에 넘길 DOM 노드. React 마커 컴포넌트는 포털로 이 안에 그린다.
  const [nodes] = useState(() => ({
    spots: new Map(spots.map(spot => [spot.id, document.createElement("div")])),
    current: document.createElement("div"),
    bubble: document.createElement("div"),
    peak: document.createElement("div"),
  }));

  const current = position ?? (currentIndex === undefined ? undefined : route[currentIndex]);
  const currentRef = useRef(current);
  const showBubble = current !== undefined && traveledKm !== undefined;

  // 아래 효과들보다 먼저 실행되어 지도를 만들 때·지도를 맞출 때 최신 값을 쓰게 한다.
  useEffect(() => {
    currentRef.current = current;
    traveledPathRef.current = traveledPath;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASE_MAP_STYLE_URL,
      bounds: routeBounds(route),
      fitBoundsOptions: { padding: withSheetInset(padding, containerRef.current) },
      maxZoom: MAP_MAX_ZOOM,
      attributionControl: false,
      minZoom: MAP_MIN_ZOOM,
    });
    // 내 등산 지도에는 출처 표시를 넣지 않는다 (팀 결정 전 임시. OSM 데이터는 ODbL상 출처 표시가 필요하다).
    mapRef.current = map;
    const removeMapLimit = limitMapToSouthKorea(map);
    map.on("error", () => setHasLoadError(true));
    // 배경 타일을 기다리지 않도록 스타일만 준비되면 경로를 그린다.
    const drawRoute = () => {
      if (map.getSource("hike-remaining")) return;
      const layout = { "line-cap": "round", "line-join": "round" } as const;
      if (currentIndex !== undefined) {
        map.addSource("hike-traveled", { type: "geojson", data: lineFeature(route.slice(0, currentIndex + 1)) });
        map.addLayer({ id: "hike-traveled", type: "line", source: "hike-traveled", layout, paint: { "line-color": TRAVELED_COLOR, "line-width": 4 } });
      }
      map.addSource("hike-remaining", { type: "geojson", data: lineFeature(route.slice(currentIndex ?? 0)) });
      map.addLayer({ id: "hike-remaining", type: "line", source: "hike-remaining", layout, paint: { "line-color": REMAINING_COLOR, "line-width": 4 } });
      map.addSource("hike-gps-path", { type: "geojson", data: pathData(traveledPathRef.current) });
      map.addLayer({ id: "hike-gps-path", type: "line", source: "hike-gps-path", layout, paint: { "line-color": TRAVELED_COLOR, "line-width": 5 } });
      // 생성 시점에는 컨테이너 크기가 확정되지 않을 수 있어 경로 전체를 다시 맞춘다.
      map.resize();
      map.fitBounds(routeBounds(route), { padding: withSheetInset(padding, map.getContainer()), duration: 0 });
    };
    map.on("style.load", drawRoute);
    map.on("load", drawRoute);

    const markers = [
      ...spots.map(spot => new Marker({ element: nodes.spots.get(spot.id)! }).setLngLat(spot.position)),
      new Marker({ element: nodes.peak, anchor: "left", offset: [-5, 0] }).setLngLat(peak),
    ];
    markers.forEach(marker => marker.addTo(map));
    setMap(map);

    return () => {
      removeMapLimit();
      markers.forEach(marker => marker.remove());
      map.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, [route, currentIndex, peak, spots, nodes, padding]);

  const currentLng = current?.[0];
  const currentLat = current?.[1];
  useEffect(() => {
    if (!map || currentLng === undefined || currentLat === undefined) return;
    const markers = [new Marker({ element: nodes.current }).setLngLat([currentLng, currentLat])];
    if (showBubble) markers.push(new Marker({ element: nodes.bubble, anchor: "bottom", offset: [-10, -14] }).setLngLat([currentLng, currentLat]));
    markers.forEach(marker => marker.addTo(map));
    return () => markers.forEach(marker => marker.remove());
  }, [map, currentLng, currentLat, showBubble, nodes]);

  useEffect(() => {
    (map?.getSource("hike-gps-path") as GeoJSONSource | undefined)?.setData(pathData(traveledPath));
  }, [map, traveledPath]);

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: dimension === "3D" ? 60 : 0, duration: 400 });
  }, [dimension]);

  // 버튼을 누를 때만 맞춘다. 현재 위치가 바뀔 때마다 지도를 옮기지 않는다.
  useEffect(() => {
    if (recenterKey === 0) return;
    const target = currentRef.current;
    if (target) mapRef.current?.easeTo({ center: target, zoom: 16, duration: 400 });
    else mapRef.current?.fitBounds(routeBounds(route), { padding: withSheetInset(padding, containerRef.current), duration: 400 });
  }, [recenterKey, route, padding]);

  const visibleSpots = spots.filter(spot => filter === "all" || spot.kind === filter);

  return <div className="hike-route-map">
    <div ref={containerRef} className="hike-route-map__canvas" aria-label={label} />
    {hasLoadError && <p className="hike-route-map__error" role="status">배경지도를 불러오지 못했어요. 경로는 계속 표시돼요.</p>}
    {visibleSpots.map(spot => createPortal(
      <SpotMarker kind={spot.kind} aria-label={spot.name} />, nodes.spots.get(spot.id)!, spot.id))}
    {createPortal(<span className="hike-route-map__peak"><span aria-hidden="true" />정상</span>, nodes.peak)}
    {current && createPortal(<span className="hike-route-map__current" role="img" aria-label="현재 위치" />, nodes.current)}
    {current && traveledKm !== undefined && createPortal(<DistanceBubble label={`${traveledKm.toFixed(1)} km`}
      aria-label={`지금까지 ${traveledKm.toFixed(1)} km 이동`} />, nodes.bubble)}
  </div>;
}
