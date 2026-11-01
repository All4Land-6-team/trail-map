import type { CommunityMapBounds } from './CommunityMap'
import type { Coordinate } from '../../../types/community'

export function nearestCoordinate(coordinates: readonly Coordinate[], reference: Coordinate): Coordinate {
  if (coordinates.length === 0) return reference
  const distance = ([longitude, latitude]: Coordinate) => (longitude - reference[0]) ** 2 + (latitude - reference[1]) ** 2
  return coordinates.slice(1).reduce((nearest, coordinate) => distance(coordinate) < distance(nearest) ? coordinate : nearest, coordinates[0])
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
