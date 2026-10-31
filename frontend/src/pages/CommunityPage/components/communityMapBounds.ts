import type { CommunityMapBounds } from './CommunityMap'
import type { Coordinate } from '../../../types/community'

export function centerCoordinateBounds(coordinates: readonly Coordinate[], fallback: Coordinate): Coordinate {
  const valid = coordinates.filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude))
  if (valid.length === 0) return fallback
  const longitudes = valid.map(([longitude]) => longitude)
  const latitudes = valid.map(([, latitude]) => latitude)
  return [(Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    (Math.min(...latitudes) + Math.max(...latitudes)) / 2]
}

export function bufferMapBounds(bounds: CommunityMapBounds): CommunityMapBounds {
  const longitudeMargin = (bounds.east - bounds.west) / 2
  const latitudeMargin = (bounds.north - bounds.south) / 2
  return {
    west: Math.max(-180, bounds.west - longitudeMargin),
    south: Math.max(-90, bounds.south - latitudeMargin),
    east: Math.min(180, bounds.east + longitudeMargin),
    north: Math.min(90, bounds.north + latitudeMargin),
  }
}

export function coversMapBounds(outer: CommunityMapBounds, inner: CommunityMapBounds): boolean {
  return outer.west <= inner.west && outer.south <= inner.south
    && outer.east >= inner.east && outer.north >= inner.north
}
