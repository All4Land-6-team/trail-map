import { LngLatBounds, MercatorCoordinate, type MapLibreMap } from 'maplibre-gl'
import { MAP_MIN_ZOOM, SOUTH_KOREA_BOUNDS } from '../constants/map'

// MapLibre 벡터 타일 한 장의 화면 크기(px)
const TILE_SIZE = 512
// 경계 계산 오차로 최대 축소 화면이 이동 범위를 넘지 않도록 두는 여유 비율
const BOUNDS_MARGIN = 1.01

/** 남한 전체가 보이는 줌을 최대 축소 수준으로, 그때 보이는 영역을 이동 범위로 사용한다. */
export function limitMapToSouthKorea(map: MapLibreMap): () => void {
  const updateLimits = () => {
    const { clientWidth, clientHeight } = map.getContainer()
    if (!clientWidth || !clientHeight) return

    const camera = map.cameraForBounds(SOUTH_KOREA_BOUNDS)
    if (camera?.zoom === undefined || !Number.isFinite(camera.zoom) || !camera.center) return

    const minZoom = Math.max(MAP_MIN_ZOOM, camera.zoom)
    // 화면 비율이 남한 범위와 달라도 최대 축소 화면 전체가 들어가도록 이동 범위를 화면 크기에 맞춘다.
    const center = MercatorCoordinate.fromLngLat(camera.center)
    const worldSize = TILE_SIZE * 2 ** minZoom
    const halfWidth = (clientWidth / 2 / worldSize) * BOUNDS_MARGIN
    const halfHeight = (clientHeight / 2 / worldSize) * BOUNDS_MARGIN
    const southWest = new MercatorCoordinate(center.x - halfWidth, center.y + halfHeight).toLngLat()
    const northEast = new MercatorCoordinate(center.x + halfWidth, center.y - halfHeight).toLngLat()

    map.setMinZoom(minZoom)
    map.setMaxBounds(new LngLatBounds(southWest, northEast))
  }

  map.on('resize', updateLimits)
  updateLimits()
  return () => map.off('resize', updateLimits)
}
