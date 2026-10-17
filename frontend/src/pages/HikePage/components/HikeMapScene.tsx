import type { ReactNode } from "react";
import { Chip } from "../../../components/common/Chip";
import { BottomNavigation, TopBar, type BottomDestination } from "../../../components/layout";
import { BaseMap, MapAction, SpotMarker, type MapRoute } from "../../../components/map";

type HikeMapSceneProps = {
  title: string;
  route: MapRoute;
  activeNavigation?: BottomDestination;
  children?: ReactNode;
  onBack: () => void;
  onNavigate: (destination: BottomDestination) => void;
};

const filters = ["전체", "쉼터", "음수대", "화장실", "사진 스팟", "기타"] as const;

export function HikeMapScene({
  title,
  route,
  activeNavigation = "myHikes",
  children,
  onBack,
  onNavigate,
}: HikeMapSceneProps) {
  const longitudes = route.coordinates.map(([longitude]) => longitude);
  const latitudes = route.coordinates.map(([, latitude]) => latitude);
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];

  return (
    <main className="hike-screen">
      <BaseMap
        ariaLabel={`${title} 코스 지도`}
        bounds={bounds}
        fitBoundsPadding={{ top: 145, right: 50, bottom: 255, left: 50 }}
        routes={[route]}
        showNavigationControl={false}
        className="hike-map"
      />
      <TopBar title={title} onBack={onBack} showAction={false} className="hike-topbar" />
      <div className="hike-filter-row" aria-label="지도 시설 필터">
        {filters.map((label, index) => (
          <Chip key={label} label={label} selected={index === 0} />
        ))}
      </div>
      <div className="hike-map-actions">
        <MapAction iconName="3D" defaultDimensionMode="3D" />
        <MapAction iconName="Locate" />
      </div>
      <div className="hike-demo-spots" aria-label="코스 주변 시설">
        <SpotMarker kind="photo" className="hike-demo-spot hike-demo-spot--photo-one" />
        <SpotMarker kind="shelter" className="hike-demo-spot hike-demo-spot--shelter" />
        <SpotMarker kind="water" className="hike-demo-spot hike-demo-spot--water" />
        <SpotMarker kind="restroom" className="hike-demo-spot hike-demo-spot--restroom" />
      </div>
      {children}
      <BottomNavigation active={activeNavigation} onNavigate={onNavigate} className="hike-bottom-nav" />
    </main>
  );
}
