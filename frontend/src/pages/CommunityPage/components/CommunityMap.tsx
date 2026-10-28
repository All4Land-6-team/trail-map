import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { MapLibreMap } from 'maplibre-gl'
import BaseMap, { type MapRoute } from '../../../components/map/BaseMap'
import { MapAction, MountainMarker, SpotMarker, supportsTerrain, type MapDimension, type TerrainStatus } from '../../../components/map'
import { Icon } from '../../../components/common/Icon'
import type { Coordinate, SpotType } from '../../../types/community'
import { communityMarkerMode } from './communityMapZoom'

export type CommunityMapMarker = {
  id: string
  name: string
  label?: string
  kind: 'mountain' | 'spot' | 'course' | 'point'
  coordinate: Coordinate
  spotType?: SpotType
  selected?: boolean
  shortLabel?: string
  color?: string
}

export type CommunityMapRoute = {
  id: string
  color: string
  coordinates: Coordinate[]
  selected?: boolean
}

type Props = {
  markers?: readonly CommunityMapMarker[]
  overviewMarker?: CommunityMapMarker
  mountainId?: string
  center?: Coordinate
  focusTarget?: { coordinate: Coordinate; request: number; zoom?: number; resetZoom?: boolean }
  zoom?: number
  showRoute?: boolean
  highlightedRoute?: Coordinate[]
  fitHighlightedRoute?: boolean
  highlightedRouteColor?: string
  highlightedRoutes?: readonly CommunityMapRoute[]
  onMarkerSelect?: (marker: CommunityMapMarker) => void
  onMapSelect?: (coordinate: Coordinate) => void
  children?: ReactNode
  className?: string
  ariaLabel?: string
}

const EMPTY_ROUTES: readonly MapRoute[] = []
const DEFAULT_CENTER: Coordinate = [126.977, 37.659]
const MARKER_CLUSTER_DISTANCE = 48

type ProjectedMarker = { marker: CommunityMapMarker; x: number; y: number }

function groupNearbyMarkers(markers: readonly ProjectedMarker[]) {
  const remaining = markers.filter(({ marker }) => marker.kind !== 'mountain')
  const groups: ProjectedMarker[][] = []
  for (const marker of remaining) {
    const group = groups.find(items => {
      const centerX = items.reduce((sum, item) => sum + item.x, 0) / items.length
      const centerY = items.reduce((sum, item) => sum + item.y, 0) / items.length
      return Math.hypot(centerX - marker.x, centerY - marker.y) < MARKER_CLUSTER_DISTANCE
    })
    if (group) group.push(marker)
    else groups.push([marker])
  }
  return groups
}

function visibleMapArea(map: MapLibreMap) {
  const mapRect = map.getContainer().getBoundingClientRect()
  const page = map.getContainer().closest('.community-page')
  const sheetTop = page?.querySelector('.community-page__sheet')?.getBoundingClientRect().top ?? mapRect.bottom
  const topBarBottom = page?.querySelector('.community-page__topbar')?.getBoundingClientRect().bottom ?? mapRect.top
  const filterBottom = page?.querySelector('.community-map-filters')?.getBoundingClientRect().bottom ?? topBarBottom
  const visibleTop = Math.max(0, Math.max(topBarBottom, filterBottom) - mapRect.top)
  const visibleBottom = Math.min(mapRect.height, sheetTop - mapRect.top)
  return { visibleTop, visibleBottom, visibleCenter: (visibleTop + Math.max(visibleTop, visibleBottom)) / 2, mapHeight: mapRect.height }
}

export function CommunityMap({ markers = [], overviewMarker, mountainId, center = DEFAULT_CENTER, focusTarget, zoom = 14, showRoute = true,
  highlightedRoute, fitHighlightedRoute = false, highlightedRouteColor, highlightedRoutes, onMarkerSelect, onMapSelect, children, className, ariaLabel = '커뮤니티 예시 지도' }: Props) {
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [projected, setProjected] = useState<ProjectedMarker[]>([])
  const [markerMode, setMarkerMode] = useState(() => communityMarkerMode(zoom))
  const [clusterChoices, setClusterChoices] = useState<CommunityMapMarker[]>([])
  const [mapUnavailable, setMapUnavailable] = useState(false)
  const [mapRetry, setMapRetry] = useState(0)
  const [dimension, setDimension] = useState<MapDimension>('2D')
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus>('idle')
  const isMainMap = className?.includes('community-page__map--main') ?? false
  const terrainEnabled = supportsTerrain(mountainId ?? overviewMarker?.id)
  const onReady = useCallback((instance: MapLibreMap | null) => { setMap(instance); if (instance) setMapUnavailable(false) }, [])
  const markerSignature = [...markers, ...(overviewMarker ? [overviewMarker] : [])]
    .map(marker => `${marker.id}:${marker.coordinate.join(',')}:${marker.selected}`).join('|')
  // MapLibre 객체는 화면별로 유지하고 이동/크기 변경 때만 핀 좌표를 다시 계산한다.
  const markerSnapshot = useMemo(() => markers, [markerSignature]) // eslint-disable-line react-hooks/exhaustive-deps
  const overviewSnapshot = useMemo(() => overviewMarker, [markerSignature]) // eslint-disable-line react-hooks/exhaustive-deps
  const routes = useMemo<readonly MapRoute[]>(() => {
    if (!showRoute) return EMPTY_ROUTES
    const targets = highlightedRoutes ?? (highlightedRoute ? [{ id: 'selected', color: highlightedRouteColor ?? '#19765b', coordinates: highlightedRoute }] : [])
    const selectedRouteOnly = highlightedRoutes === undefined
    const hasSelectedRoute = highlightedRoutes?.some(route => route.selected) ?? false
    return targets
      .filter(route => route.coordinates.length > 1)
      .map(route => ({ id: `community-course-${route.id}`, color: route.color, coordinates: route.coordinates,
        opacity: selectedRouteOnly || !hasSelectedRoute || route.selected ? 1 : 0.3, outlineColor: '#ffffff',
        outlineWidth: selectedRouteOnly || route.selected ? 8 : 5, width: selectedRouteOnly || route.selected ? 5 : 3 }))
  }, [showRoute, highlightedRoute, highlightedRouteColor, highlightedRoutes])

  useEffect(() => {
    if (!map) return
    const update = () => {
      const mode = communityMarkerMode(map.getZoom())
      if (isMainMap) setMarkerMode(mode)
      const visibleMarkers = isMainMap && mode === 'overview'
        ? overviewSnapshot ? [overviewSnapshot] : markerSnapshot.filter(marker => marker.kind === 'mountain')
        : markerSnapshot
      setProjected(visibleMarkers.map(marker => {
        const point = map.project(marker.coordinate)
        return { marker, x: point.x, y: point.y }
      }))
    }
    const focusOverview = () => {
      if (!isMainMap || communityMarkerMode(map.getZoom()) !== 'overview') return
      const marker = overviewSnapshot ?? markerSnapshot.find(item => item.kind === 'mountain')
      if (!marker) return
      const { visibleCenter, mapHeight } = visibleMapArea(map)
      map.easeTo({ center: marker.coordinate, offset: [0, visibleCenter - mapHeight / 2],
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220 })
    }
    const observer = new ResizeObserver(() => { map.resize(); update() })
    observer.observe(map.getContainer())
    map.on('move', update)
    map.on('resize', update)
    map.on('zoomend', focusOverview)
    update()
    return () => { observer.disconnect(); map.off('move', update); map.off('resize', update); map.off('zoomend', focusOverview) }
  }, [map, markerSnapshot, overviewSnapshot, isMainMap])

  useEffect(() => {
    if (!map) return
    const onLoad = () => setMapUnavailable(false)
    const timer = window.setTimeout(() => { if (!map.isStyleLoaded()) setMapUnavailable(true) }, 8000)
    map.on('load', onLoad)
    return () => { window.clearTimeout(timer); map.off('load', onLoad) }
  }, [map])

  useEffect(() => {
    if (!map || !className?.includes('community-page__map')) return
    // 시트는 지도 위 오버레이이므로 시트의 높이로 카메라 중심을 옮기지 않는다.
    map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 })
  }, [map, className])

  useEffect(() => {
    if (!map || terrainEnabled) return
    const pitch = isMainMap && dimension === '3D' ? 50 : 0
    if (map.getPitch() === pitch) return
    map.easeTo({ pitch, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350 })
  }, [map, isMainMap, dimension, terrainEnabled])

  useEffect(() => {
    if (!map || !fitHighlightedRoute) return
    const coordinates = highlightedRoutes?.flatMap(route => route.coordinates) ?? highlightedRoute ?? []
    if (coordinates.length < 2) return
    const longitudes = coordinates.map(([longitude]) => longitude)
    const latitudes = coordinates.map(([, latitude]) => latitude)
    map.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], {
      padding: 24,
      maxZoom: 16,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350,
    })
  }, [map, fitHighlightedRoute, highlightedRoute, highlightedRoutes])

  useEffect(() => {
    if (!map || !focusTarget || !(className?.includes('community-page__map--select') || className?.includes('community-page__map--main') || className?.includes('community-page__map--detail-mountain') || className?.includes('community-page__map--detail-spot') || className?.includes('community-page__map--detail-course'))) return
    const { visibleTop, visibleBottom, visibleCenter, mapHeight } = visibleMapArea(map)
    if (className.includes('community-page__map--detail-course') && highlightedRoute && highlightedRoute.length > 1) {
      const longitudes = highlightedRoute.map(([longitude]) => longitude)
      const latitudes = highlightedRoute.map(([, latitude]) => latitude)
      map.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], {
        padding: { top: visibleTop + 24, right: 24, bottom: Math.max(24, mapHeight - visibleBottom + 24), left: 24 },
        maxZoom: 16,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550,
      })
      return
    }
    const focusY = className.includes('community-page__map--detail-mountain') || className.includes('community-page__map--mountain-focus')
      ? Math.max(visibleTop + 44, Math.min(visibleCenter - 28, visibleTop + 48)) : visibleCenter
    map.easeTo({ center: focusTarget.coordinate, offset: [0, focusY - mapHeight / 2],
      zoom: focusTarget.zoom === undefined ? map.getZoom() : focusTarget.resetZoom
        ? focusTarget.zoom : Math.max(map.getZoom(), focusTarget.zoom),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550,
      easing: progress => 1 - (1 - progress) ** 3 })
  }, [map, focusTarget, className, highlightedRoute])

  useEffect(() => {
    if (!map || !onMapSelect) return
    const select = (event: { lngLat: { lng: number; lat: number } }) => onMapSelect([event.lngLat.lng, event.lngLat.lat])
    map.on('click', select)
    return () => { map.off('click', select) }
  }, [map, onMapSelect])

  const markerGroups = isMainMap && markerMode === 'cluster' ? groupNearbyMarkers(projected)
    : projected.filter(({ marker }) => marker.kind !== 'mountain').map(item => [item])
  const mountainMarkers = projected.filter(({ marker }) => marker.kind === 'mountain')
  const displayedGroups = [...mountainMarkers.map(item => [item]), ...markerGroups]

  const expandCluster = (group: readonly ProjectedMarker[]) => {
    if (!map) return
    if (map.getZoom() >= Math.min(18, map.getMaxZoom() - 0.5)) {
      setClusterChoices(group.map(item => item.marker))
      return
    }
    const center: Coordinate = [
      group.reduce((total, item) => total + item.marker.coordinate[0], 0) / group.length,
      group.reduce((total, item) => total + item.marker.coordinate[1], 0) / group.length,
    ]
    const { visibleCenter, mapHeight } = visibleMapArea(map)
    map.easeTo({ center, offset: [0, visibleCenter - mapHeight / 2], zoom: Math.min(map.getZoom() + 2, map.getMaxZoom()),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220 })
  }

  return <div className={['community-map', className].filter(Boolean).join(' ')} data-marker-mode={isMainMap ? markerMode : undefined}>
    <BaseMap key={mapRetry} className="community-map__base" ariaLabel={ariaLabel} center={center} zoom={zoom}
      routes={routes} showNavigationControl={false} onMapReady={onReady}
      terrainMode={terrainEnabled ? dimension : undefined} onTerrainStatusChange={setTerrainStatus} />
    {mapUnavailable && <div className="community-map__fallback" role="status"><span>지도 배경을 불러오지 못했어요. 목록이나 마커로 후기를 볼 수 있어요.</span>
      <button type="button" onClick={() => { setMapUnavailable(false); setMapRetry(current => current + 1) }}>다시 시도</button></div>}
    {isMainMap && <MapAction className="community-map__dimension" dimensionMode={dimension === '2D' ? '3D' : '2D'}
      aria-label={`${dimension === '2D' ? '3D' : '2D'} 지도 보기`} aria-pressed={dimension === '3D'}
      aria-busy={terrainEnabled && terrainStatus === 'loading'}
      disabled={!map || mapUnavailable || (terrainEnabled && terrainStatus !== 'ready')}
      onDimensionModeChange={() => setDimension(current => current === '2D' ? '3D' : '2D')} />}
    <div className="community-map__markers" aria-label="지도 항목">
      {displayedGroups.map(group => group.length > 1 ? <div key={group.map(item => item.marker.id).join('|')}
        className="community-map__pin community-map__pin--cluster"
        style={{ left: group.reduce((total, item) => total + item.x, 0) / group.length,
          top: group.reduce((total, item) => total + item.y, 0) / group.length } as CSSProperties}>
        <button type="button" className="community-map__cluster"
          aria-label={`겹친 지도 항목 ${group.length}개 확대 또는 목록 보기`} onClick={() => expandCluster(group)}><span>{group.length}</span></button>
      </div> : group.map(({ marker, x, y }) => <div key={marker.id} className={`community-map__pin community-map__pin--${marker.kind}${marker.selected ? ' community-map__pin--selected' : ''}`}
        style={{ left: x, top: y } as CSSProperties}>
        {marker.kind === 'mountain'
          ? <MountainMarker name={marker.name} variant="point" selected={marker.selected} aria-label={`${marker.name} 선택`} onClick={() => onMarkerSelect?.(marker)} />
          : marker.kind === 'spot' && marker.spotType !== 'other'
            ? <SpotMarker kind={marker.spotType ?? 'photo'} label={marker.name} aria-pressed={marker.selected}
                aria-label={`${marker.name} 선택`} onClick={() => onMarkerSelect?.(marker)} />
            : <button type="button" className={`community-map__custom-marker community-map__custom-marker--${marker.kind}`}
                style={marker.color ? { '--community-course-color': marker.color } as CSSProperties : undefined}
                aria-label={`${marker.name} 선택`} aria-pressed={marker.selected} onClick={() => onMarkerSelect?.(marker)}>
                <span className="community-map__custom-symbol">{marker.shortLabel ?? <Icon name="Pin" size={18} />}</span>
                {marker.kind !== 'point' && marker.kind !== 'course' && <span className="community-map__custom-label">{marker.label ?? marker.name}</span>}
              </button>}
      </div>))}
    </div>
    {clusterChoices.length > 0 && <div className="community-map__cluster-choices" role="dialog" aria-label="겹친 지도 항목 선택">
      <button type="button" className="community-map__cluster-close" onClick={() => setClusterChoices([])} aria-label="목록 닫기">×</button>
      <strong>이 위치의 항목</strong>{clusterChoices.map(marker => <button type="button" key={`${marker.kind}-${marker.id}`} onClick={() => { onMarkerSelect?.(marker); setClusterChoices([]) }}>{marker.name}</button>)}
    </div>}
    {children}
  </div>
}
