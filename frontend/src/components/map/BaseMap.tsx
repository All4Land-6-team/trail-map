import { useEffect, useRef, useState } from 'react'
import { MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  BASE_MAP_STYLE_URL,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  SOUTH_KOREA_BOUNDS,
} from '../../constants/map'

// MapLibre 6은 워커 파일이 분리되어 있어 Vite가 번들한 주소를 직접 지정한다
setWorkerUrl(workerUrl)

function BaseMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasLoadError, setHasLoadError] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASE_MAP_STYLE_URL,
      bounds: SOUTH_KOREA_BOUNDS,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
    })

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.on('error', () => setHasLoadError(true))

    return () => map.remove()
  }, [])

  return <div className="base-map-shell">
    <div ref={containerRef} className="base-map" aria-label="남한 배경지도" />
    {hasLoadError && <div className="base-map__notice" role="status">
      <span>지도를 불러오는 중 문제가 발생했습니다. 네트워크 상태를 확인해 주세요.</span>
      <button type="button" aria-label="지도 오류 알림 닫기" onClick={() => setHasLoadError(false)}>×</button>
    </div>}
  </div>
}

export default BaseMap
