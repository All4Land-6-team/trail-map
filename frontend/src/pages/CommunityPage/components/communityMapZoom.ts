export type CommunityMarkerMode = 'overview' | 'cluster' | 'individual'

export function communityMarkerMode(zoom: number): CommunityMarkerMode {
  if (zoom < 12) return 'overview'
  if (zoom < 13) return 'cluster'
  return 'individual'
}
