import type { LngLatBoundsLike } from 'maplibre-gl'

export const BASE_MAP_STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty'

// 남한 전체 [서, 남, 동, 북]: 백령도·마라도·독도·고성 포함
export const SOUTH_KOREA_BOUNDS: LngLatBoundsLike = [124.5, 33, 132, 38.7]

// 섬을 제외한 남한 본토 안쪽의 초기 화면 중심 (충북 중부)
export const SOUTH_KOREA_MAINLAND_CENTER: [longitude: number, latitude: number] = [127.77, 36.8]

export const MAP_MIN_ZOOM = 4
export const MAP_MAX_ZOOM = 18
