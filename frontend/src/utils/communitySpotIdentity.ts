import type { CommunitySpot } from '../types/community';

export function communitySpotKey(targetType: CommunitySpot['targetType'], targetId: string | number) {
  return `${targetType}:${targetId}`;
}

export function communitySpotTargetId(spot: Pick<CommunitySpot, 'id'>) {
  return spot.id.split(':').at(-1)!;
}

/** 명시한 스팟은 없더라도 다른 스팟으로 대체하지 않는다. 이전 숫자 URL은 유일할 때만 복원한다. */
export function resolveSpotSelection(spots: readonly CommunitySpot[], current: string, requested?: string) {
  if (spots.some(spot => spot.id === current)) return current;
  if (requested) {
    const matches = spots.filter(spot => spot.id === requested || communitySpotTargetId(spot) === requested);
    return matches.length === 1 ? matches[0].id : requested;
  }
  return spots[0]?.id ?? '';
}
