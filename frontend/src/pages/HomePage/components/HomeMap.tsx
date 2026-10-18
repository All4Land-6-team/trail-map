import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { MapLibreMap } from "maplibre-gl";
import BaseMap from "../../../components/map/BaseMap";
import { MountainMarker } from "../../../components/map";
import { SOUTH_KOREA_MAINLAND_CENTER } from "../../../constants/map";
import type { HomeMountain } from "../../../types/home";

type HomeMapProps = {
  mountains: readonly HomeMountain[];
  selectedMountainId: string | null;
  onSelect: (mountainId: string) => void;
  onMapClick: () => void;
};

type ProjectedMountain = { mountain: HomeMountain; x: number; y: number; labelOffset: number; labelLeft: boolean };

/** 실제 지도 좌표를 유지하면서 가까운 산 이름이 겹치지 않도록 라벨만 펼친다. */
function projectMountains(map: MapLibreMap, mountains: readonly HomeMountain[]): ProjectedMountain[] {
  const width = map.getCanvas().clientWidth;
  const rows = mountains.map((mountain) => {
    const point = map.project(mountain.position);
    return { mountain, x: point.x, y: point.y, labelOffset: 0, labelLeft: point.x > width - 92 };
  }).sort((a, b) => a.y - b.y);
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    for (let previous = 0; previous < index; previous++) {
      const other = rows[previous];
      const labelY = other.y + other.labelOffset;
      if (Math.abs(row.x - other.x) < 100 && row.y + row.labelOffset - labelY < 36) {
        row.labelOffset = labelY + 36 - row.y;
      }
    }
  }
  return rows;
}

export function HomeMap({ mountains, selectedMountainId, onSelect, onMapClick }: HomeMapProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [positions, setPositions] = useState<ProjectedMountain[]>([]);
  const handleMapReady = useCallback((instance: MapLibreMap | null) => setMap(instance), []);

  useEffect(() => {
    if (!map) return;
    const update = () => setPositions(projectMountains(map, mountains));
    const canvas = map.getCanvas();
    const observer = new ResizeObserver(() => { map.resize(); update(); });
    observer.observe(canvas.parentElement ?? canvas);
    map.on("move", update);
    map.on("resize", update);
    map.on("click", onMapClick);
    update();
    return () => {
      observer.disconnect();
      map.off("move", update);
      map.off("resize", update);
      map.off("click", onMapClick);
    };
  }, [map, mountains, onMapClick]);

  return <div className="home-map">
    <BaseMap className="home-map__base" center={SOUTH_KOREA_MAINLAND_CENTER} zoom={6.1}
      showNavigationControl={false} onMapReady={handleMapReady} />
    <div className="home-map__markers" aria-label="지도에서 산 선택">
      {positions.map(({ mountain, x, y, labelOffset, labelLeft }) => <div key={mountain.id}
        className="home-map__pin" data-side={labelLeft ? "left" : "right"}
        style={{ left: x, top: y, "--home-label-offset": `${labelOffset}px` } as CSSProperties}>
        {labelOffset > 0 && <span className="home-map__leader" aria-hidden="true" style={{ height: labelOffset }} />}
        <MountainMarker name={mountain.name} variant="point" selected={selectedMountainId === mountain.id}
          onClick={() => onSelect(mountain.id)} />
      </div>)}
    </div>
  </div>;
}
