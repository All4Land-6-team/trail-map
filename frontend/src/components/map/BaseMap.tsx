import { useEffect, useRef } from 'react'
import { MapLibreMap, setWorkerUrl } from 'maplibre-gl'
import type { LngLatBoundsLike } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

// MapLibre 6은 워커 파일이 분리되어 있어 Vite가 번들한 주소를 직접 지정한다
setWorkerUrl(workerUrl)

// OpenFreeMap Liberty: OSM 기반 벡터 스타일
const BASE_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

// 남한 전체 [서, 남, 동, 북]: 백령도·마라도·독도·고성 포함
const SOUTH_KOREA_BOUNDS: LngLatBoundsLike = [124.5, 33, 132, 38.7]

function BaseMap() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASE_MAP_STYLE_URL,
      bounds: SOUTH_KOREA_BOUNDS,
    })

    return () => map.remove()
  }, [])

  return <div ref={containerRef} className="base-map" />
}

export default BaseMap
