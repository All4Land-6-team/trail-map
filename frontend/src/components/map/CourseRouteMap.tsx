import { useCallback, useEffect, useRef, useState } from "react";
import { LngLatBounds, type FilterSpecification, type GeoJSONSource, type GeoJSONSourceSpecification, type MapLayerMouseEvent, type MapLibreMap } from "maplibre-gl";
import BaseMap from "./BaseMap";
import { MapAction, type MapDimension } from "./MapAction";
import { supportsTerrain, type TerrainStatus } from "./terrain";
import type { Course } from "../../types/course";
import type { CourseProfileSample, CourseSpot } from "../../types/courseDetail";
import { SpotMarker } from "./SpotMarker";
import "./course-route-map.css";

const summitAsset = new URL("../../assets/icons/course-summit.svg", import.meta.url).href;
const detailPeakAsset = new URL("../../assets/icons/detail-peak.svg", import.meta.url).href;
const detailSummitAsset = new URL("../../assets/icons/detail-summit.svg", import.meta.url).href;
const profilePositionAsset = new URL("../../assets/icons/profile-position.svg", import.meta.url).href;
const SOURCE = "discovery-course-routes";
const ROUTE_LAYER = "discovery-course-lines";
const ACTIVE_OUTLINE = "discovery-active-outline";
const ACTIVE_ROUTE = "discovery-active-route";
export type CourseRouteMapProps = {
  courses: readonly Course[];
  selected: Course | null;
  mountainId?: string;
  center: [number, number];
  mapBottomInset?: number;
  onSelect: (id: string) => void;
  onNotify: (message: string) => void;
  variant?: "list" | "detail";
  profileSample?: CourseProfileSample | null;
  summitCoordinate?: [number, number] | null;
  summitLabel?: string;
  dataLabel?: string | null;
  spots?: readonly CourseSpot[];
  selectedSpotId?: string;
  focusSpotId?: string;
  showSpotLabels?: boolean;
  onSpotSelect?: (id: string) => void;
};

export function CourseRouteMap({ courses, selected, mountainId, center, mapBottomInset = 0, onSelect, onNotify, variant = "list", profileSample,
  summitCoordinate, summitLabel = "정상", dataLabel, spots, selectedSpotId, focusSpotId, showSpotLabels = false, onSpotSelect }: CourseRouteMapProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [routesReady, setRoutesReady] = useState(false);
  const [dimension, setDimension] = useState<MapDimension>("2D");
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus>("idle");
  const [summit, setSummit] = useState<{ x: number; y: number } | null>(null);
  const [profilePoint, setProfilePoint] = useState<{ x: number; y: number } | null>(null);
  const [spotPoints, setSpotPoints] = useState<readonly { spot: CourseSpot; x: number; y: number }[]>([]);
  const [locating, setLocating] = useState(false);
  const alive = useRef(true);
  const terrainEnabled = supportsTerrain(mountainId ?? selected?.mountainId ?? courses[0]?.mountainId);
  const onReady = useCallback((instance: MapLibreMap | null) => setMap(instance), []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!map) return;
    let pending = true;
    function updateRoutes() {
      // 분석 응답 시점에 이전 GeoJSON source가 처리 중이면 load 이벤트는 이미 끝났을 수 있다.
      // idle에서 한 번 더 반영하되, 반영 후 idle마다 setData·카메라 맞춤을 반복하지 않는다.
      if (!map || !map.isStyleLoaded()) { pending = true; return; }
      pending = false;
      const data: GeoJSONSourceSpecification["data"] = { type: "FeatureCollection", features: courses.map(course => ({
        type: "Feature", properties: { courseId: course.id }, geometry: { type: "LineString", coordinates: course.routeCoordinates },
      })) };
      if (!map.getSource(SOURCE)) {
        map.addSource(SOURCE, { type: "geojson", data });
        map.addLayer({ id: ROUTE_LAYER, type: "line", source: SOURCE,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#94b6a0", "line-width": 3, "line-opacity": 0.7 } });
        map.addLayer({ id: ACTIVE_OUTLINE, type: "line", source: SOURCE,
          layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 9 } });
        map.addLayer({ id: ACTIVE_ROUTE, type: "line", source: SOURCE,
          layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#19765b", "line-width": 6 } });
      } else { (map.getSource(SOURCE) as GeoJSONSource).setData(data); }
      const filter: FilterSpecification = ["==", ["get", "courseId"], selected?.id ?? ""];
      map.setFilter(ACTIVE_OUTLINE, filter);
      map.setFilter(ACTIVE_ROUTE, filter);
      const height = map.getContainer().clientHeight;
      const inset = Math.min(mapBottomInset, Math.max(0, height - 1));
      const visibleHeight = Math.max(1, height - inset);
      const padding = { top: Math.min(110, visibleHeight * 0.35), bottom: inset + Math.min(36, visibleHeight * 0.15), left: 35, right: 82 };
      const focusedSpot = spots?.find(spot => spot.id === focusSpotId);
      if (focusedSpot) {
        map.easeTo({ center: focusedSpot.coordinate, padding, offset: [0, 20], duration: 200 });
      } else if (selected?.routeCoordinates.length) {
        const bounds = new LngLatBounds();
        selected.routeCoordinates.forEach(point => bounds.extend(point));
        spots?.forEach(spot => bounds.extend(spot.coordinate));
        map.fitBounds(bounds, { padding, maxZoom: 15, duration: 0 });
      } else { map.jumpTo({ center, zoom: 12 }); }
    }
    map.on("load", updateRoutes);
    map.on("resize", updateRoutes);
    const onIdle = () => {
      if (pending) updateRoutes();
      if (map.getSource(SOURCE) && map.isSourceLoaded(SOURCE)) setRoutesReady(true);
    };
    map.on("idle", onIdle);
    updateRoutes();
    return () => { map.off("load", updateRoutes); map.off("resize", updateRoutes); map.off("idle", onIdle); };
  }, [map, courses, selected, center, focusSpotId, spots, mapBottomInset]);

  useEffect(() => {
    if (!map) return;
    const selectRoute = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.courseId;
      if (typeof id === "string") onSelect(id);
    };
    map.on("click", ROUTE_LAYER, selectRoute);
    return () => { map.off("click", ROUTE_LAYER, selectRoute); };
  }, [map, onSelect]);

  useEffect(() => {
    if (!map) return;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const update = () => {
      const point = summitCoordinate ?? selected?.routeCoordinates.at(-1);
      setSummit(point ? map.project(point) : null);
      setProfilePoint(profileSample ? map.project(profileSample.coordinate) : null);
      setSpotPoints((spots ?? []).map(spot => ({ spot, ...map.project(spot.coordinate) })));
    };
    map.on("move", update);
    map.on("resize", update);
    update();
    return () => { map.off("move", update); map.off("resize", update); };
  }, [map, selected, summitCoordinate, profileSample, spots]);

  useEffect(() => {
    if (!terrainEnabled) map?.easeTo({ pitch: dimension === "3D" ? 50 : 0, duration: 350 });
  }, [map, dimension, terrainEnabled]);

  function locate() {
    if (!navigator.geolocation) { onNotify("현재 위치를 지원하지 않는 환경이에요."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      if (!alive.current) return;
      setLocating(false);
      map?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 14, duration: 500 });
    }, error => {
      if (!alive.current) return;
      setLocating(false);
      onNotify(error.code === 1 ? "위치 권한을 허용하면 현재 위치로 이동할 수 있어요." : "현재 위치를 확인하지 못했어요. 다시 시도해 주세요.");
    }, { timeout: 10000, maximumAge: 60000 });
  }

  return <div className={`course-map course-map--${variant}`} data-selected-course={selected?.id ?? ""} data-map-mode={dimension} data-route-ready={routesReady}
    aria-label={selected ? `지도 경로: ${selected.name}` : "코스 지도"}>
    <BaseMap className="course-map__base" showNavigationControl={false} onMapReady={onReady}
      terrainBeforeLayerId={ROUTE_LAYER} terrainMode={terrainEnabled ? dimension : undefined}
      onTerrainStatusChange={setTerrainStatus} />
    {summit && (variant === "list" || summitCoordinate) && <div className="course-map__summit" style={{ left: summit.x, top: summit.y }}>
      {variant === "detail" ? <><img className="course-map__peak" src={detailPeakAsset} alt="" />
        <img src={detailSummitAsset} alt="" /><span>{summitLabel}</span></> : <><img src={summitAsset} alt="" /><span>{summitLabel}</span></>}
    </div>}
    {profilePoint && profileSample && <span className="course-map__profile-point"
      data-profile-distance={profileSample.distanceKm} data-profile-coordinate={profileSample.coordinate.join(",")}
      style={{ left: profilePoint.x, top: profilePoint.y }} aria-label={`그래프 선택 위치 ${profileSample.distanceKm.toFixed(1)} km`}>
      <img src={profilePositionAsset} alt="" />
    </span>}
    {spotPoints.map(({ spot, x, y }) => <SpotMarker key={spot.id} kind={spot.kind} compact
      className="course-map__spot" style={{ left: x, top: y }} data-spot-id={spot.id}
      aria-label={`${spot.name} 지도에서 선택`} aria-pressed={spot.id === selectedSpotId}
      label={showSpotLabels ? spot.name : undefined} onClick={() => onSpotSelect?.(spot.id)} />)}
    <div className="course-map__actions">
      <MapAction dimensionMode={dimension === "2D" ? "3D" : "2D"} aria-label={`${dimension === "2D" ? "3D" : "2D"} 지도 보기`}
        aria-busy={terrainEnabled && terrainStatus === "loading"}
        disabled={!map || (terrainEnabled && terrainStatus !== "ready")}
        onDimensionModeChange={() => setDimension(current => current === "2D" ? "3D" : "2D")} />
      <MapAction iconName="Locate" disabled={!map || locating} aria-busy={locating}
        aria-label={locating ? "현재 위치 확인 중" : "현재 위치"} onClick={locate} />
    </div>
    {dataLabel !== null && <span className="course-map__example">{dataLabel ?? (variant === "detail" ? "경로·분석 예시" : "예시 경로")}</span>}
  </div>;
}
