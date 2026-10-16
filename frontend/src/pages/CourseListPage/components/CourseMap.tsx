import { useCallback, useEffect, useRef, useState } from "react";
import { LngLatBounds, type FilterSpecification, type GeoJSONSource, type GeoJSONSourceSpecification, type MapLayerMouseEvent, type MapLibreMap } from "maplibre-gl";
import BaseMap from "../../../components/map/BaseMap";
import { MapAction } from "../../../components/map";
import type { Course } from "../../../types/course";

const summitAsset = new URL("../../../assets/icons/course-summit.svg", import.meta.url).href;
const SOURCE = "discovery-course-routes";
const ROUTE_LAYER = "discovery-course-lines";
const ACTIVE_OUTLINE = "discovery-active-outline";
const ACTIVE_ROUTE = "discovery-active-route";
type Props = {
  courses: readonly Course[];
  selected: Course | null;
  center: [number, number];
  onSelect: (id: string) => void;
  onNotify: (message: string) => void;
};

export function CourseMap({ courses, selected, center, onSelect, onNotify }: Props) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [dimension, setDimension] = useState<"2D" | "3D">("2D");
  const [summit, setSummit] = useState<{ x: number; y: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const alive = useRef(true);
  const onReady = useCallback((instance: MapLibreMap | null) => setMap(instance), []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!map) return;
    function updateRoutes() {
      if (!map || !map.isStyleLoaded()) return;
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
      if (selected?.routeCoordinates.length) {
        const bounds = new LngLatBounds();
        selected.routeCoordinates.forEach(point => bounds.extend(point));
        const height = map.getContainer().clientHeight;
        map.fitBounds(bounds, { padding: { top: Math.min(110, height * 0.35), bottom: Math.min(36, height * 0.15), left: 35, right: 82 }, maxZoom: 15, duration: 0 });
      } else { map.jumpTo({ center, zoom: 12 }); }
    }
    map.on("load", updateRoutes);
    updateRoutes();
    return () => { map.off("load", updateRoutes); };
  }, [map, courses, selected, center]);

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
    const update = () => {
      const point = selected?.routeCoordinates.at(-1);
      setSummit(point ? map.project(point) : null);
    };
    const observer = new ResizeObserver(() => { map.resize(); update(); });
    observer.observe(map.getContainer());
    map.on("move", update);
    map.on("resize", update);
    update();
    return () => { observer.disconnect(); map.off("move", update); map.off("resize", update); };
  }, [map, selected]);

  useEffect(() => {
    map?.easeTo({ pitch: dimension === "3D" ? 50 : 0, duration: 350 });
  }, [map, dimension]);

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

  return <div className="course-map" data-selected-course={selected?.id ?? ""} data-map-mode={dimension}
    aria-label={selected ? `지도 경로: ${selected.name}` : "코스 지도"}>
    <BaseMap className="course-map__base" showNavigationControl={false} onMapReady={onReady} />
    {summit && <div className="course-map__summit" style={{ left: summit.x, top: summit.y }}>
      <img src={summitAsset} alt="" /><span>정상</span>
    </div>}
    <div className="course-map__actions">
      <MapAction dimensionMode={dimension === "2D" ? "3D" : "2D"} aria-label={`${dimension === "2D" ? "3D" : "2D"} 지도 보기`}
        disabled={!map} onDimensionModeChange={() => setDimension(current => current === "2D" ? "3D" : "2D")} />
      <MapAction iconName="Locate" disabled={!map || locating} aria-busy={locating}
        aria-label={locating ? "현재 위치 확인 중" : "현재 위치"} onClick={locate} />
    </div>
    <span className="course-map__example">예시 경로</span>
  </div>;
}
