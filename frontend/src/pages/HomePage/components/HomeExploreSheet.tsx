import type { HTMLAttributes } from "react";
import { Button } from "../../../components/common/Button";
import { Chip } from "../../../components/common/Chip";
import { Typography } from "../../../components/common/Typography";
import { BottomSheet } from "../../../components/overlay";
import type { HomeMountain } from "../../../types/home";

type HomeExploreSheetProps = {
  isSearching: boolean;
  status: "idle" | "loading" | "success" | "error";
  recentMountains: readonly HomeMountain[];
  recommendedMountains: readonly HomeMountain[];
  onSelect: (mountainId: string) => void;
  onRetry: () => void;
  handleProps: HTMLAttributes<HTMLDivElement>;
};

export function HomeExploreSheet({ isSearching, status, recentMountains, recommendedMountains, onSelect, onRetry, handleProps }: HomeExploreSheetProps) {
  const displayedMountains = isSearching || recentMountains.length === 0 ? recommendedMountains : recentMountains;
  return <BottomSheet title="가고 싶은 산을 찾아보세요"
    description="산을 선택하면 코스와 후기를 볼 수 있어요."
    showClose={false} className="home-explore-sheet" handleProps={handleProps}
    content={<div className="home-explore-sheet__body">
      {status === "idle" || status === "loading"
        ? <Typography as="p" variant="bodySmall" role="status">산 정보를 불러오고 있어요.</Typography>
        : status === "error"
          ? <div className="home-explore-sheet__error" role="alert">
              <Typography as="p" variant="bodySmall">산 정보를 불러오지 못했어요.</Typography>
              <Button size="compact" onClick={onRetry}>다시 시도</Button>
            </div>
          : <>
              <div className="home-explore-sheet__picks" aria-label={isSearching || recentMountains.length === 0 ? "추천 산" : "최근 본 산"}>
                {!isSearching && <Typography variant="descriptionSmall" className="home-explore-sheet__label">
                  {recentMountains.length > 0 ? "최근 본 산 :" : "추천 산 :"}
                </Typography>}
                <div className="home-explore-sheet__chips">
                  {displayedMountains.map((mountain) => <Chip key={mountain.id} label={mountain.name}
                    variant="action" onClick={() => onSelect(mountain.id)} />)}
                </div>
              </div>
              {isSearching && <div className="home-explore-sheet__recents" aria-label="최근 본 산">
                <Typography variant="descriptionSmall">최근 본 산 ·</Typography>
                {recentMountains.length === 0
                  ? <Typography variant="descriptionSmall">아직 없어요.</Typography>
                  : <div className="home-explore-sheet__recent-links">{recentMountains.map((mountain) => <button
                      type="button" key={mountain.id} onClick={() => onSelect(mountain.id)}>
                      <Typography variant="controlLabel">{mountain.name}</Typography>
                    </button>)}</div>}
              </div>}
            </>}
    </div>} />;
}
