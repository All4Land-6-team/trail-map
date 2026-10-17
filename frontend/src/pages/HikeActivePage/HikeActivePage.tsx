import { useState } from "react";
import { sampleActiveHike } from "../../api/hikeMock";
import { NearbyAlert, Toast } from "../../components/feedback";
import { HikeEndConfirm, HikeRouteMap, HikeShareSheet, SpotFilterChips, type SpotFilter } from "../../components/hike";
import { BottomNavigation, TopBar } from "../../components/layout";
import { MapAction } from "../../components/map";
import { navigate, readHashParams } from "../../hooks/useHashRoute";
import { useToastMessage } from "../../hooks/useToastMessage";
import { hikePaths, navigateTab } from "../hikeRoutes";
import { HikeProgressSheet } from "./components/HikeProgressSheet";
import "../hikePages.css";
import "./HikeActivePage.css";

/** HIKE-05 등산 중 (`#hikes/active?alerts=on|off`). 알림 기본값은 HIKE-04 알림 수신 확인에서 고른 값이다. */
export function HikeActivePage() {
  const hike = sampleActiveHike;
  const [filter, setFilter] = useState<SpotFilter>("all");
  const [dimension, setDimension] = useState<"2D" | "3D">("2D");
  const [recenterKey, setRecenterKey] = useState(0);
  const [alertsOn, setAlertsOn] = useState(() => readHashParams().get("alerts") !== "off");
  const [nearbyClosed, setNearbyClosed] = useState(false);
  const [overlay, setOverlay] = useState<"share" | "end" | null>(null);
  const toast = useToastMessage();

  return <div className="hike-page hike-map-page hike-active-page">
    <main className="hike-page__body hike-map-page__body">
      <div className="hike-map-page__map">
        <HikeRouteMap route={hike.route} peak={hike.peak} currentIndex={hike.currentIndex} traveledKm={hike.traveledKm}
          spots={hike.spots} filter={filter} dimension={dimension} recenterKey={recenterKey}
          label={`${hike.courseName} 등산 경로 지도`} />
        <div className="hike-map-page__top">
          <TopBar title="등산 중" showAction={false} onBack={() => navigate(hikePaths.calendar())} />
          <SpotFilterChips value={filter} onChange={setFilter} />
        </div>
        <div className="hike-map-page__tools">
          <MapAction iconName="3D" dimensionMode={dimension} onDimensionModeChange={setDimension}
            aria-label={dimension === "3D" ? "2D 지도로 전환" : "3D 지도로 전환"} />
          <MapAction aria-label="현재 위치로 이동" onClick={() => setRecenterKey(key => key + 1)} />
          <MapAction variant="brand" aria-label="공유" onClick={() => setOverlay("share")} />
        </div>
        {alertsOn && hike.nearby && !nearbyClosed && <NearbyAlert className="hike-active-page__nearby"
          title={hike.nearby.title} detail={hike.nearby.detail} onClose={() => setNearbyClosed(true)} />}
      </div>
      <HikeProgressSheet stage="ascent" courseName={hike.courseName}
        traveledKm={hike.traveledKm} remainingKm={hike.remainingKm} sunset={hike.sunset}
        alertsOn={alertsOn} onAlertsChange={setAlertsOn}
        onStartDescent={() => navigate(hikePaths.downhill(alertsOn))} onEnd={() => setOverlay("end")} />
      {toast.message && <Toast className="hike-page__toast hike-active-page__toast" message={toast.message} />}
    </main>
    <BottomNavigation className="hike-page__nav" active="home" onNavigate={navigateTab} />

    {overlay === "share" && <HikeShareSheet onClose={() => setOverlay(null)} onShareSpot={() => {
      setOverlay(null);
      toast.show("새 스팟 등록(COMM-07)은 아직 준비 중이에요");
    }} />}
    {overlay === "end" && <HikeEndConfirm onCancel={() => setOverlay(null)}
      onConfirm={() => navigate(hikePaths.complete)} />}
  </div>;
}
