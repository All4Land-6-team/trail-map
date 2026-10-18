import type { CommunityReview, CommunitySpot, Coordinate, SegmentStatus, SpotType, SpotVote } from '../types/community'

/** 목 화면 검수용 값. 서버 정책이나 자동 병합 규칙이 아니다. */
export const DUPLICATE_RADIUS_METERS = 30
export const SPOT_HIDE_NEGATIVE_VOTES = 3
export const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000
export const SEGMENT_STATUS_CONFIRMATION_COUNT = 5

/** 최신순으로 연속된 동일 상태 후기 5건이 쌓이면 상태를 확정한다. 그 전에는 직전 확정 상태를 유지한다. */
export function resolveSegmentStatus(reviews: readonly CommunityReview[], baseline: SegmentStatus = 'caution'): SegmentStatus {
  const ordered = reviews.filter((review): review is CommunityReview & { status: SegmentStatus } => review.kind === 'segment' && review.status !== undefined)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  let runStatus: SegmentStatus | undefined
  let runLength = 0
  for (const review of ordered) {
    if (review.status === runStatus) runLength += 1
    else { runStatus = review.status; runLength = 1 }
    if (runLength >= SEGMENT_STATUS_CONFIRMATION_COUNT) return review.status
  }
  return baseline
}

export function canWriteReview(completedHike: { mountainId: string; finishedAt: string } | undefined, mountainId: string, now = Date.now()): boolean {
  if (!completedHike || completedHike.mountainId !== mountainId) return false
  const finishedAt = Date.parse(completedHike.finishedAt)
  return Number.isFinite(finishedAt) && finishedAt <= now && now - finishedAt <= REVIEW_WINDOW_MS
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLon = (b[0] - a[0]) * rad
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function isSpotHidden(vote?: SpotVote): boolean {
  return (vote?.no ?? 0) >= SPOT_HIDE_NEGATIVE_VOTES
}

export function nearbySpotCandidates(spots: readonly CommunitySpot[], coordinate: Coordinate, type: SpotType, votes: Record<string, SpotVote>) {
  return spots.filter(spot => spot.type === type && !isSpotHidden(votes[spot.id]))
    .map(spot => ({ spot, meters: distanceMeters(spot.coordinate, coordinate) }))
    .filter(result => result.meters <= DUPLICATE_RADIUS_METERS)
    .sort((a, b) => a.meters - b.meters)
}

export function castSpotVote(current: SpotVote, choice: 'yes' | 'no'): SpotVote {
  if (current.viewer === choice) return { ...current, [choice]: Math.max(0, current[choice] - 1), viewer: null }
  return {
    yes: current.yes + (choice === 'yes' ? 1 : 0) - (current.viewer === 'yes' ? 1 : 0),
    no: current.no + (choice === 'no' ? 1 : 0) - (current.viewer === 'no' ? 1 : 0),
    viewer: choice,
  }
}
