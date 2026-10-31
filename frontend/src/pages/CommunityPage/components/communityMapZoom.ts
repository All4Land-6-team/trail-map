export type CommunityMarkerMode = 'overview' | 'cluster' | 'individual'

export function communityMarkerMode(zoom: number): CommunityMarkerMode {
  if (zoom < 12.5) return 'overview'
  if (zoom < 14.5) return 'cluster'
  return 'individual'
}
