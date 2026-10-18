import { useEffect, useRef, useState } from 'react'
import {
  MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type LngLatBoundsLike,
  type MapOptions,
  type PaddingOptions,
} from 'maplibre-gl'
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

export type BaseMapProps = {
  ariaLabel?: string
  bounds?: LngLatBoundsLike
  center?: [longitude: number, latitude: number]
  className?: string
  fitBoundsPadding?: number | PaddingOptions
  routes?: readonly MapRoute[]
  showNavigationControl?: boolean
  zoom?: number
  /** 지도 생성·해제 시 알린다. 레이어를 추가할 때는 load 이벤트를 기다린다. */
  onMapReady?: (map: MapLibreMap | null) => void
}

export type MapRoute = {
  id: string
  color: string
  coordinates: [longitude: number, latitude: number][]
  showEndpoint?: boolean
}

const EMPTY_ROUTES: readonly MapRoute[] = []

function BaseMap({
  ariaLabel = '남한 배경지도',
  bounds,
  center,
  className,
  fitBoundsPadding,
  routes = EMPTY_ROUTES,
  showNavigationControl = true,
  zoom,
  onMapReady,
}: BaseMapProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const onMapReadyRef = useRef(onMapReady)
  const renderedRouteIdsRef = useRef<string[]>([])
  const routesRef = useRef(routes)
  const [hasLoadError, setHasLoadError] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [hasStaticCacheMiss, setHasStaticCacheMiss] = useState(false)

  useEffect(() => { onMapReadyRef.current = onMapReady }, [onMapReady])
  useEffect(() => { routesRef.current = routes }, [routes])

  useEffect(() => {
    const updateConnection = () => {
      const offline = !navigator.onLine
      setIsOffline(offline)
      if (!offline) setHasStaticCacheMiss(false)
    }
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'STATIC_GEO_CACHE_MISS') setHasStaticCacheMiss(true)
    }

    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    navigator.serviceWorker?.addEventListener('message', handleWorkerMessage)

    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
      navigator.serviceWorker?.removeEventListener('message', handleWorkerMessage)
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    let map: MapLibreMap
    try {
      const mapOptions: MapOptions = {
        container: containerRef.current,
        style: BASE_MAP_STYLE_URL,
        attributionControl: { compact: true },
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        fitBoundsOptions: fitBoundsPadding ? { padding: fitBoundsPadding } : undefined,
        ...(bounds
          ? { bounds }
          : center
            ? { center, zoom: zoom ?? 13 }
            : { bounds: SOUTH_KOREA_BOUNDS }),
      }
      map = new MapLibreMap(mapOptions)
      // 출처 링크는 정보 버튼에 유지하되, 지도가 열릴 때 긴 표시가 화면을 덮지 않게 한다.
      const collapseAttribution = () => {
        const attribution = map.getContainer().querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib')
        if (!attribution) return
        attribution.classList.add('maplibregl-compact')
        attribution.classList.remove('maplibregl-compact-show')
        attribution.open = false
      }
      collapseAttribution()
      map.once('load', collapseAttribution)
    } catch {
      const frame = requestAnimationFrame(() => setHasLoadError(true))
      return () => cancelAnimationFrame(frame)
    }

    if (showNavigationControl) map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    map.on('load', () => {
      renderedRouteIdsRef.current = replaceMapRoutes(
        map,
        renderedRouteIdsRef.current,
        routesRef.current,
      )
    })
    map.on('error', () => setHasLoadError(true))
    onMapReadyRef.current?.(map)

    return () => {
      onMapReadyRef.current?.(null)
      mapRef.current = null
      renderedRouteIdsRef.current = []
      map.remove()
    }
  }, [bounds, center, fitBoundsPadding, showNavigationControl, zoom])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const updateRoutes = () => {
      if (!map.isStyleLoaded()) return
      map.off('styledata', updateRoutes)
      renderedRouteIdsRef.current = replaceMapRoutes(map, renderedRouteIdsRef.current, routesRef.current)
    }

    if (map.isStyleLoaded()) updateRoutes()
    else map.on('styledata', updateRoutes)

    return () => {
      map.off('styledata', updateRoutes)
    }
  }, [routes])

  return <div className={["base-map-shell", className].filter(Boolean).join(' ')}>
    <div ref={containerRef} className="base-map" aria-label={ariaLabel} />
    {(isOffline || hasLoadError || hasStaticCacheMiss) && <div className="base-map__notices" aria-live="polite">
      {isOffline && <div className="base-map__notice">
        오프라인입니다. 앱 화면과 저장된 정적 정보는 계속 사용할 수 있지만, 배경지도는 브라우저에 남은 부분만 보일 수 있습니다. 실시간 정보는 연결 후 다시 확인해 주세요.
      </div>}
      {hasLoadError && <div className="base-map__notice">
        <span>{isOffline
          ? '이 지역의 지도가 저장되어 있지 않거나 불러올 수 없습니다.'
          : '지도를 불러오는 중 문제가 발생했습니다. 네트워크 상태를 확인해 주세요.'}</span>
        <button type="button" aria-label="지도 오류 알림 닫기" onClick={() => setHasLoadError(false)}>×</button>
      </div>}
      {hasStaticCacheMiss && <div className="base-map__notice">
        <span>이 지역의 등산로·시설물 정보는 저장되어 있지 않습니다. 연결 후 다시 조회해 주세요.</span>
        <button type="button" aria-label="미저장 정보 알림 닫기" onClick={() => setHasStaticCacheMiss(false)}>×</button>
      </div>}
    </div>}
  </div>
}

function replaceMapRoutes(
  map: MapLibreMap,
  renderedRouteIds: readonly string[],
  routes: readonly MapRoute[],
) {
  renderedRouteIds.forEach((sourceId) => {
    const endpointLayerId = `${sourceId}-endpoint`
    if (map.getLayer(endpointLayerId)) map.removeLayer(endpointLayerId)
    if (map.getLayer(sourceId)) map.removeLayer(sourceId)
    if (map.getSource(sourceId)) map.removeSource(sourceId)
  })

  return routes.map((route) => {
    const sourceId = `course-route-${route.id}`
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { kind: 'route' },
            geometry: { type: 'LineString', coordinates: route.coordinates },
          },
          ...(route.showEndpoint && route.coordinates.length > 0 ? [{
            type: 'Feature' as const,
            properties: { kind: 'endpoint' },
            geometry: {
              type: 'Point' as const,
              coordinates: route.coordinates.at(-1)!,
            },
          }] : []),
        ],
      },
    })
    map.addLayer({
      id: sourceId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': route.color,
        'line-opacity': 0.95,
        'line-width': 4,
      },
    })
    if (route.showEndpoint) {
      map.addLayer({
        id: `${sourceId}-endpoint`,
        type: 'circle',
        source: sourceId,
        filter: ['==', ['get', 'kind'], 'endpoint'],
        paint: {
          'circle-color': '#ffffff',
          'circle-radius': 5,
          'circle-stroke-color': route.color,
          'circle-stroke-width': 2.5,
        },
      })
    }
    return sourceId
  })
}

export default BaseMap
