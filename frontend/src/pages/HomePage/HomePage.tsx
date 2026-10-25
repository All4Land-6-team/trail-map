import { BottomNavigation, type BottomDestination } from "../../components/layout";
import { Toast } from "../../components/feedback";
import { useResizableMapSheet } from "../../hooks/useResizableMapSheet";
import { homePaths, navigateFromHome } from "../../routes/homeRoutes";
import type { TodayHikeSchedule } from "../../types/home";
import { HomeExploreSheet } from "./components/HomeExploreSheet";
import { HomeMap } from "./components/HomeMap";
import { HomeSearchBar } from "./components/HomeSearchBar";
import { TodayHikeNotice } from "./components/TodayHikeNotice";
import { useHomeDiscovery } from "./hooks/useHomeDiscovery";
import "./home.css";

type HomePageProps = {
  onMountainSelect?: (mountainId: string) => void;
  onScheduleOpen?: (schedule: TodayHikeSchedule) => void;
  /** App.tsx가 개발 서버에서만 전달하는 화면 검수 조건. */
  previewSchedule?: "none" | "active";
};

export function HomePage({
  onMountainSelect = (id) => navigateFromHome(homePaths.mountainCourses(id)),
  onScheduleOpen = (schedule) => navigateFromHome(homePaths.todayHike(schedule.phase)),
  previewSchedule,
}: HomePageProps) {
  const home = useHomeDiscovery();
  const { rootRef, handleProps } = useResizableMapSheet({ kind: "home", navigationSelector: ".home-page__nav", label: "산 탐색 시트 높이 조절" });
  const schedule = previewSchedule === "none" ? undefined : home.todaySchedule
    ? { ...home.todaySchedule, phase: previewSchedule === "active" ? "active" as const : home.todaySchedule.phase }
    : undefined;

  function selectMountain(mountainId: string) {
    const mountain = home.selectMountain(mountainId);
    if (mountain) onMountainSelect(mountain.id);
  }
  function searchMountain() {
    const mountain = home.searchMountain();
    if (mountain) onMountainSelect(mountain.id);
  }
  function navigateTab(destination: BottomDestination) {
    if (destination === "home") {
      home.resetHome();
      navigateFromHome(homePaths.home);
    } else {
      navigateFromHome(homePaths[destination]);
    }
  }

  return <main ref={rootRef} className="home-page" aria-label="산 탐색">
    <div className="home-page__map-area">
      <HomeMap mountains={home.mountains} selectedMountainId={home.selectedMountainId}
        onSelect={selectMountain} onMapClick={home.closeSearch} />
      <div className="home-page__top">
        <HomeSearchBar isSearching={home.isSearching} query={home.query}
          onOpen={home.openSearch} onClose={home.closeSearch} onQueryChange={home.setQuery} onSearch={searchMountain} />
        {!home.isSearching && schedule && <TodayHikeNotice schedule={schedule} onOpen={() => onScheduleOpen(schedule)} />}
      </div>
    </div>
    <HomeExploreSheet isSearching={home.isSearching} status={home.state.status}
      handleProps={handleProps}
      recentMountains={home.recentMountains} recommendedMountains={home.recommendedMountains}
      onSelect={selectMountain} onRetry={home.retry} />
    <BottomNavigation active="home" onNavigate={navigateTab} className="home-page__nav" />
    {home.toast && <Toast key={home.toast.id} message={home.toast.message} className="home-page__toast" />}
  </main>;
}
