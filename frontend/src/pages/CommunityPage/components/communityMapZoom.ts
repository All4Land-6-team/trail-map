export type CommunityMarkerMode = 'overview' | 'cluster' | 'individual'

export function communityMarkerMode(zoom: number): CommunityMarkerMode {
  if (zoom < 13) return 'overview'
  if (zoom < 16) return 'cluster'
  return 'individual'
}
