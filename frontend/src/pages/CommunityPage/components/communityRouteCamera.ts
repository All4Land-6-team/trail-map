import type { Coordinate } from '../../../types/community'

type ScreenPoint = { x: number; y: number }
type ScreenViewport = { top: number; right: number; bottom: number; left: number }

export function communityRouteBounds(coordinates: readonly Coordinate[]) {
  if (coordinates.length < 2) return null
  const longitudes = coordinates.map(([longitude]) => longitude)
  const latitudes = coordinates.map(([, latitude]) => latitude)
  return [[Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)]] as [Coordinate, Coordinate]
}

export function communityRouteBearing(coordinates: readonly Coordinate[]) {
  const start = coordinates[0]
  const end = coordinates.at(-1)
  if (!start || !end) return 0
  const latitude1 = start[1] * Math.PI / 180
  const latitude2 = end[1] * Math.PI / 180
  const longitudeDelta = (end[0] - start[0]) * Math.PI / 180
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2)
  const x = Math.cos(latitude1) * Math.sin(latitude2)
    - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta)
  return x === 0 && y === 0 ? 0 : Math.atan2(y, x) * 180 / Math.PI
}

export function communityRouteCameraAdjustment(points: readonly ScreenPoint[], viewport: ScreenViewport) {
  if (points.length < 2) return null
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  const scale = Math.min(
    Math.max(1, viewport.right - viewport.left) / Math.max(1, right - left),
    Math.max(1, viewport.bottom - viewport.top) / Math.max(1, bottom - top),
  )
  return {
    zoomDelta: Math.log2(scale),
    offset: [
      (left + right) / 2 - (viewport.left + viewport.right) / 2,
      (top + bottom) / 2 - (viewport.top + viewport.bottom) / 2,
    ] as [number, number],
  }
}
