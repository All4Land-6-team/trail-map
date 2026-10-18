import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AttributionControl, LngLatBounds, MapLibreMap, Marker, setWorkerUrl, type PaddingOptions } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { DistanceBubble, SpotMarker } from "../map";
import { BASE_MAP_STYLE_URL, MAP_MAX_ZOOM } from "../../constants/map";
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

function lineFeature(coordinates: LngLat[]) {
  return { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates } };
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
  route, label, peak = route[route.length - 1], currentIndex, traveledKm, spots = NO_SPOTS,
  filter = "all", dimension = "2D", recenterKey = 0, padding = DEFAULT_PADDING,
}: HikeRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  // MapLibre Marker에 넘길 DOM 노드. React 마커 컴포넌트는 포털로 이 안에 그린다.
  const [nodes] = useState(() => ({
    spots: new Map(spots.map(spot => [spot.id, document.createElement("div")])),
    current: document.createElement("div"),
    bubble: document.createElement("div"),
    peak: document.createElement("div"),
  }));

  const current = currentIndex === undefined ? undefined : route[currentIndex];
  const showBubble = current !== undefined && traveledKm !== undefined;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASE_MAP_STYLE_URL,
      bounds: routeBounds(route),
      fitBoundsOptions: { padding: withSheetInset(padding, containerRef.current) },
      maxZoom: MAP_MAX_ZOOM,
      attributionControl: false,
    });
    // 근접 알림이 오른쪽 아래에 뜨므로 출처 표시는 왼쪽 아래에 둔다.
    map.addControl(new AttributionControl({ compact: true }), "bottom-left");
    mapRef.current = map;
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
    if (current) {
      markers.push(new Marker({ element: nodes.current }).setLngLat(current));
      if (showBubble) markers.push(new Marker({ element: nodes.bubble, anchor: "bottom", offset: [-10, -14] }).setLngLat(current));
    }
    markers.forEach(marker => marker.addTo(map));

    return () => {
      markers.forEach(marker => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [route, currentIndex, current, peak, spots, nodes, padding, showBubble]);

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: dimension === "3D" ? 60 : 0, duration: 400 });
  }, [dimension]);

  useEffect(() => {
    if (recenterKey === 0) return;
    if (current) mapRef.current?.easeTo({ center: current, zoom: 16, duration: 400 });
    else mapRef.current?.fitBounds(routeBounds(route), { padding: withSheetInset(padding, containerRef.current), duration: 400 });
  }, [recenterKey, current, route, padding]);

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
