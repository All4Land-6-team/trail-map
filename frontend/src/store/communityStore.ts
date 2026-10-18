import { useSyncExternalStore } from "react";
import { communitySpots, initialSpotVotes } from "../api/communityMock";
import type { CommunityReview, CommunitySpot, SpotVote } from "../types/community";

type CommunityData = {
  spots: CommunitySpot[];
  reviews: CommunityReview[];
  votes: Record<string, SpotVote>;
  segmentVotes: Record<string, SpotVote>;
};
// 사진의 blob URL을 포함하므로 새로고침 전까지 메모리에서만 공유한다.
let data: CommunityData = { spots: communitySpots, reviews: [], votes: initialSpotVotes, segmentVotes: {} };
const listeners = new Set<() => void>();
function setter<K extends keyof CommunityData>(key: K) {
  return (update: (previous: CommunityData[K]) => CommunityData[K]) => {
    const next = update(data[key]);
    if (Object.is(next, data[key])) return;
    data = { ...data, [key]: next };
    listeners.forEach(listener => listener());
  };
}
export const setCommunitySpots = setter("spots");
export const setCommunityReviews = setter("reviews");
export const setCommunityVotes = setter("votes");
export const setCommunitySegmentVotes = setter("segmentVotes");
export function useCommunityData() {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, () => data);
}
