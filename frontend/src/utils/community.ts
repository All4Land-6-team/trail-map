import type { CommunitySpot, Coordinate, SpotType, SpotVote } from '../types/community'
import type { CompletedHike } from '../store/hikeSessionStore'

/** 목 화면 검수용 값. 서버 정책이나 자동 병합 규칙이 아니다. */
export const DUPLICATE_RADIUS_METERS = 30
export const SPOT_HIDE_NEGATIVE_VOTES = 3
export const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000
function isEligibleCompletion(hike: CompletedHike, mountainId: string, now: number): boolean {
  const finishedAt = Date.parse(hike.finishedAt)
  return hike.mountainId === mountainId && Number.isFinite(finishedAt) && finishedAt <= now && now - finishedAt <= REVIEW_WINDOW_MS
}

export function eligibleCourseCompletions(completedHikes: readonly CompletedHike[], mountainId: string, now = Date.now()): CompletedHike[] {
  const newestByCourse = new Map<string, CompletedHike>()
  completedHikes.filter(hike => isEligibleCompletion(hike, mountainId, now))
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
    .forEach(hike => { if (!newestByCourse.has(hike.courseId)) newestByCourse.set(hike.courseId, hike) })
  return [...newestByCourse.values()]
}

export function canWriteReview(completedHikes: readonly CompletedHike[], mountainId: string, now = Date.now()): boolean {
  return eligibleCourseCompletions(completedHikes, mountainId, now).length > 0
}

export function canWriteCourseReview(completedHikes: readonly CompletedHike[], mountainId: string, courseId: string,
  completedHikeId: string | undefined, now = Date.now()): boolean {
  return eligibleCourseCompletions(completedHikes, mountainId, now)
    .some(hike => hike.id === completedHikeId && hike.courseId === courseId)
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
