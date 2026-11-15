import { useEffect, useRef, useState } from 'react'
import {
  MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type FilterSpecification,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapMouseEvent,
  type MapOptions,
  type PaddingOptions,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadTerrainSource } from '../../api/terrain'
import { limitMapToSouthKorea } from '../../utils/mapZoom'
import {
  BASE_MAP_STYLE_URL,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  SOUTH_KOREA_BOUNDS,
  SOUTH_KOREA_MAINLAND_CENTER,
} from '../../constants/map'
import type { MapDimension } from './MapAction'
import { applyTerrainMode, installTerrainLayers, isTerrainSourceError, removeTerrainLayers, type TerrainStatus } from './terrain'

// MapLibre 6은 워커 파일이 분리되어 있어 Vite가 번들한 주소를 직접 지정한다
setWorkerUrl(workerUrl)

export type BaseMapProps = {
  ariaLabel?: string
  bounds?: LngLatBoundsLike
  center?: [longitude: number, latitude: number]
  className?: string
  fitBoundsPadding?: number | PaddingOptions
  routes?: readonly MapRoute[]
  enableRouteHover?: boolean
  showNavigationControl?: boolean
  terrainBeforeLayerId?: string
  terrainMode?: MapDimension
  terrainCameraManaged?: boolean
  zoom?: number
  /** 지도 생성·해제 시 알린다. 레이어를 추가할 때는 load 이벤트를 기다린다. */
  onMapReady?: (map: MapLibreMap | null) => void
  onTerrainStatusChange?: (status: TerrainStatus) => void
}

export type MapRoute = {
  id: string
  color: string
  coordinates: [longitude: number, latitude: number][]
  opacity?: number
  outlineColor?: string
  outlineWidth?: number
  showEndpoint?: boolean
  width?: number
}

const EMPTY_ROUTES: readonly MapRoute[] = []
const ROUTE_HOVER_SOURCE = 'base-map-route-hover'
const ROUTE_HOVER_OUTLINE = 'base-map-route-hover-outline'
const ROUTE_HOVER_LINE = 'base-map-route-hover-line'
const EMPTY_ROUTE_FILTER: FilterSpecification = ['==', ['get', 'routeId'], '']

function BaseMap({
  ariaLabel = '남한 배경지도',
  bounds,
  center,
  className,
  fitBoundsPadding,
  routes = EMPTY_ROUTES,
  enableRouteHover = false,
  showNavigationControl = true,
  terrainBeforeLayerId,
  terrainMode,
  terrainCameraManaged,
  zoom,
  onMapReady,
  onTerrainStatusChange,
}: BaseMapProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const onMapReadyRef = useRef(onMapReady)
  const onTerrainStatusChangeRef = useRef(onTerrainStatusChange)
  const renderedRouteIdsRef = useRef<string[]>([])
  const routesRef = useRef(routes)
  const terrainModeRef = useRef(terrainMode)
  const terrainCameraOptions = useRef({ cameraManaged: terrainCameraManaged })
  const [hasLoadError, setHasLoadError] = useState(false)
  const [hasTerrainError, setHasTerrainError] = useState(false)
  const [mapLoadVersion, setMapLoadVersion] = useState(0)
  const [terrainRetryVersion, setTerrainRetryVersion] = useState(0)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [hasStaticCacheMiss, setHasStaticCacheMiss] = useState(false)
  const terrainEnabled = terrainMode !== undefined

  useEffect(() => { onMapReadyRef.current = onMapReady }, [onMapReady])
  useEffect(() => { onTerrainStatusChangeRef.current = onTerrainStatusChange }, [onTerrainStatusChange])
  useEffect(() => { routesRef.current = routes }, [routes])
  useEffect(() => {
    terrainModeRef.current = terrainMode
    terrainCameraOptions.current = { cameraManaged: terrainCameraManaged }
    const map = mapRef.current
    if (map && terrainMode && map.isStyleLoaded()) applyTerrainMode(map, terrainMode, terrainCameraOptions.current)
  }, [terrainMode, terrainCameraManaged])

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
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        // 지도 위에는 출처 표시를 넣지 않는다 (팀 결정 전 임시. OSM 데이터는 ODbL상 출처 표시가 필요하다).
        attributionControl: false,
        fitBoundsOptions: fitBoundsPadding ? { padding: fitBoundsPadding } : undefined,
        ...(bounds
          ? { bounds }
          : center
            ? { center, zoom: zoom ?? 13 }
            : { bounds: SOUTH_KOREA_BOUNDS }),
      }
      map = new MapLibreMap(mapOptions)
      // 커뮤니티 화면의 터치 제스처에서도 회전·기울기 입력을 유지한다.
      map.dragRotate.enable()
      map.touchZoomRotate.enable()
      map.touchZoomRotate.enableRotation()
      map.touchPitch.enable()
      map.on('style.load', () => guardNullableRoadShieldFilter(map))
      if (!bounds && !center) map.jumpTo({ center: SOUTH_KOREA_MAINLAND_CENTER })
    } catch {
      const frame = requestAnimationFrame(() => setHasLoadError(true))
      return () => cancelAnimationFrame(frame)
    }

    const removeMapLimit = limitMapToSouthKorea(map)
    if (showNavigationControl) map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    const handleLoad = () => {
      renderedRouteIdsRef.current = replaceMapRoutes(
        map,
        renderedRouteIdsRef.current,
        routesRef.current,
      )

      setMapLoadVersion((version) => version + 1)
    }
    const handleError = (event: unknown) => {
      if (import.meta.env.DEV) {
        const error = event as { error?: { message?: string }; sourceId?: string };
        console.error('MapLibre 지도 오류', error.error?.message ?? '원인 미확인', error.sourceId ?? '');
      }
      if (!isTerrainSourceError(event)) {
        setHasLoadError(true)
        return
      }

      removeTerrainLayers(map)
      map.easeTo({ pitch: 0, duration: 350 })
      setHasTerrainError(true)
      onTerrainStatusChangeRef.current?.('error')
    }
    map.on('load', handleLoad)
    map.on('error', handleError)
    onMapReadyRef.current?.(map)

    return () => {
      map.off('load', handleLoad)
      map.off('error', handleError)
      removeMapLimit()
      onTerrainStatusChangeRef.current?.('idle')
      onMapReadyRef.current?.(null)
      mapRef.current = null
      renderedRouteIdsRef.current = []
      map.remove()
    }
  }, [bounds, center, fitBoundsPadding, showNavigationControl, zoom])

  useEffect(() => {
    const map = mapRef.current
    if (!map || mapLoadVersion === 0) return

    if (!terrainEnabled) {
      removeTerrainLayers(map)
      onTerrainStatusChangeRef.current?.('idle')
      return
    }

    let cancelled = false
    onTerrainStatusChangeRef.current?.('loading')
    void loadTerrainSource({ forceRefresh: terrainRetryVersion > 0 })
      .then((source) => {
        if (cancelled || mapRef.current !== map) return
        const beforeLayerId = terrainBeforeLayerId && map.getLayer(terrainBeforeLayerId)
          ? terrainBeforeLayerId
          : renderedRouteIdsRef.current[0]
        installTerrainLayers(map, source, beforeLayerId)
        applyTerrainMode(map, terrainModeRef.current ?? '2D', terrainCameraOptions.current)
        setHasTerrainError(false)
        onTerrainStatusChangeRef.current?.('ready')
      })
      .catch(() => {
        if (cancelled || mapRef.current !== map) return
        map.setTerrain(null)
        map.easeTo({ pitch: 0, duration: 350 })
        setHasTerrainError(true)
        onTerrainStatusChangeRef.current?.('error')
      })

    return () => { cancelled = true }
  }, [mapLoadVersion, terrainBeforeLayerId, terrainRetryVersion, terrainEnabled])

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

  useEffect(() => {
    const map = mapRef.current
    if (!map || !enableRouteHover || mapLoadVersion === 0) return
    const routeIds = renderedRouteIdsRef.current.map(routeId => `${routeId}-hit`)
    const hoverRoutes = routes.filter(route => route.coordinates.length > 1)
    if (routeIds.length < 2 || hoverRoutes.length < 2) return
    const data = {
      type: 'FeatureCollection' as const,
      features: hoverRoutes.map(route => ({
        type: 'Feature' as const,
        properties: {
          routeId: `course-route-${route.id}`,
          color: route.color,
          opacity: route.opacity ?? 0.95,
          width: (route.width ?? 4) + 2,
          outlineColor: route.outlineColor ?? route.color,
          outlineOpacity: 1,
          outlineWidth: (route.outlineWidth ?? (route.width ?? 4) + 3) + 2,
        },
        geometry: { type: 'LineString' as const, coordinates: route.coordinates },
      })),
    }
    const source = map.getSource(ROUTE_HOVER_SOURCE) as GeoJSONSource | undefined
    if (source) source.setData(data)
    else {
      map.addSource(ROUTE_HOVER_SOURCE, { type: 'geojson', data })
      map.addLayer({ id: ROUTE_HOVER_OUTLINE, type: 'line', source: ROUTE_HOVER_SOURCE, filter: EMPTY_ROUTE_FILTER,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'outlineColor'], 'line-opacity': ['get', 'outlineOpacity'], 'line-width': ['get', 'outlineWidth'] } })
      map.addLayer({ id: ROUTE_HOVER_LINE, type: 'line', source: ROUTE_HOVER_SOURCE, filter: EMPTY_ROUTE_FILTER,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-opacity': ['get', 'opacity'], 'line-width': ['get', 'width'] } })
    }
    const clearHoveredRoute = () => {
      if (map.getLayer(ROUTE_HOVER_OUTLINE)) map.setFilter(ROUTE_HOVER_OUTLINE, EMPTY_ROUTE_FILTER)
      if (map.getLayer(ROUTE_HOVER_LINE)) map.setFilter(ROUTE_HOVER_LINE, EMPTY_ROUTE_FILTER)
      map.getCanvas().style.cursor = ''
    }
    const highlightRoute = (routeId: string) => {
      const filter: FilterSpecification = ['==', ['get', 'routeId'], routeId]
      map.setFilter(ROUTE_HOVER_OUTLINE, filter)
      map.setFilter(ROUTE_HOVER_LINE, filter)
      map.getCanvas().style.cursor = 'pointer'
    }
    const sourceIdFromHitLayer = (layerId: string) => layerId.slice(0, -'-hit'.length)
    const updateHoveredRoute = (event: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, { layers: routeIds })[0]
      const routeId = typeof feature?.layer?.id === 'string' ? sourceIdFromHitLayer(feature.layer.id) : null
      if (routeId) highlightRoute(routeId)
      else clearHoveredRoute()
    }
    const highlightTouchedRoute = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      const rect = map.getCanvas().getBoundingClientRect()
      const point: [number, number] = [event.clientX - rect.left, event.clientY - rect.top]
      const feature = map.queryRenderedFeatures(point, { layers: routeIds })[0]
      const routeId = typeof feature?.layer?.id === 'string' ? sourceIdFromHitLayer(feature.layer.id) : null
      if (routeId) {
        highlightRoute(routeId)
      } else clearHoveredRoute()
    }
    const clearTouchedRoute = () => {
      clearHoveredRoute()
    }
    const clearTouchState = () => clearTouchedRoute()
    const layerHandlers = routeIds.map(routeId => {
      const enter = () => highlightRoute(sourceIdFromHitLayer(routeId))
      const leave = () => clearHoveredRoute()
      map.on('mouseenter', routeId, enter)
      map.on('mouseleave', routeId, leave)
      return { routeId, enter, leave }
    })
    map.on('mousemove', updateHoveredRoute)
    map.on('mouseout', clearHoveredRoute)
    map.on('click', clearTouchState)
    map.getCanvas().addEventListener('pointerdown', highlightTouchedRoute)
    window.addEventListener('pointerup', clearTouchState)
    window.addEventListener('pointercancel', clearTouchState)
    window.addEventListener('blur', clearTouchState)
    document.addEventListener('visibilitychange', clearTouchState)
    return () => {
      layerHandlers.forEach(({ routeId, enter, leave }) => {
        map.off('mouseenter', routeId, enter)
        map.off('mouseleave', routeId, leave)
      })
      map.off('mousemove', updateHoveredRoute)
      map.off('mouseout', clearHoveredRoute)
      map.off('click', clearTouchState)
      map.getCanvas().removeEventListener('pointerdown', highlightTouchedRoute)
      window.removeEventListener('pointerup', clearTouchState)
      window.removeEventListener('pointercancel', clearTouchState)
      window.removeEventListener('blur', clearTouchState)
      document.removeEventListener('visibilitychange', clearTouchState)
      clearHoveredRoute()
      if (map.getLayer(ROUTE_HOVER_LINE)) map.removeLayer(ROUTE_HOVER_LINE)
      if (map.getLayer(ROUTE_HOVER_OUTLINE)) map.removeLayer(ROUTE_HOVER_OUTLINE)
      if (map.getSource(ROUTE_HOVER_SOURCE)) map.removeSource(ROUTE_HOVER_SOURCE)
    }
  }, [enableRouteHover, mapLoadVersion, routes])

  return <div className={["base-map-shell", className].filter(Boolean).join(' ')}>
    <div ref={containerRef} className="base-map" aria-label={ariaLabel} />
    {(isOffline || hasLoadError || hasStaticCacheMiss || (hasTerrainError && terrainEnabled)) && <div className="base-map__notices" aria-live="polite">
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
      {hasTerrainError && terrainEnabled && <div className="base-map__notice">
        <span>3D 지형을 불러오지 못했어요. 2D 지도로 표시합니다.</span>
        <button type="button" className="base-map__notice-action"
          onClick={() => {
            setHasTerrainError(false)
            setTerrainRetryVersion((version) => version + 1)
          }}>다시 시도</button>
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
    const hitLayerId = `${sourceId}-hit`
    const outlineLayerId = `${sourceId}-outline`
    if (map.getLayer(hitLayerId)) map.removeLayer(hitLayerId)
    if (map.getLayer(endpointLayerId)) map.removeLayer(endpointLayerId)
    if (map.getLayer(sourceId)) map.removeLayer(sourceId)
    if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId)
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
    if (route.outlineColor) map.addLayer({
      id: `${sourceId}-outline`,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': route.outlineColor,
        'line-opacity': route.opacity ?? 0.95,
        'line-width': route.outlineWidth ?? (route.width ?? 4) + 3,
      },
    })
    map.addLayer({
      id: sourceId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': route.color,
        'line-opacity': route.opacity ?? 0.95,
        'line-width': route.width ?? 4,
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
    map.addLayer({
      id: `${sourceId}-hit`,
      type: 'line',
      source: sourceId,
      filter: ['==', ['get', 'kind'], 'route'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': route.color,
        'line-opacity': 0,
        'line-width': (route.width ?? 4) + 4,
      },
    })
    return sourceId
  })
}

function guardNullableRoadShieldFilter(map: MapLibreMap) {
  const layerId = 'road_shield_us'
  const filter = map.getFilter(layerId)
  if (!filter) return
  map.setFilter(layerId, ['all', ['has', 'ref_length'], filter] as FilterSpecification)
}

export default BaseMap
