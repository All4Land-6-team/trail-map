import type { MapLibreMap } from 'maplibre-gl'
import { MAP_MIN_ZOOM, SOUTH_KOREA_BOUNDS } from '../constants/map'

/** 화면 크기에 맞춰 남한 전체가 보이는 줌을 최대 축소 수준으로 사용한다. */
export function limitZoomOutToSouthKorea(map: MapLibreMap): () => void {
  const updateMinZoom = () => {
    const { clientWidth, clientHeight } = map.getContainer()
    if (!clientWidth || !clientHeight) return

    const zoom = map.cameraForBounds(SOUTH_KOREA_BOUNDS)?.zoom
    if (zoom !== undefined && Number.isFinite(zoom)) {
      map.setMinZoom(Math.max(MAP_MIN_ZOOM, zoom))
    }
  }

  map.on('resize', updateMinZoom)
  updateMinZoom()
  return () => map.off('resize', updateMinZoom)
}
