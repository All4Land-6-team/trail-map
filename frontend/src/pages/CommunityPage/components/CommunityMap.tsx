import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Marker, MercatorCoordinate, type MapLibreMap } from 'maplibre-gl'
import BaseMap, { type MapRoute } from '../../../components/map/BaseMap'
import { MapAction, MountainMarker, SpotMarker, supportsTerrain, type MapDimension, type TerrainStatus } from '../../../components/map'
import mountainFlag from '../../../assets/icons/mountain-flag.svg'
import { Icon } from '../../../components/common/Icon'
import type { CommunitySpotTargetType, Coordinate, SpotType } from '../../../types/community'
import { groupCommunityMapPoints } from './communityMapClusters'
import { communityMarkerMode } from './communityMapZoom'

export type CommunityMapBounds = { west: number; south: number; east: number; north: number }

export type CommunityMapMarker = {
  id: string
  name: string
  label?: string
  kind: 'mountain' | 'spot' | 'course' | 'point'
  coordinate: Coordinate
  spotType?: SpotType
  targetType?: CommunitySpotTargetType
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
  showMountainFlag?: boolean
  showMountainLabel?: boolean
  highlightedRoute?: Coordinate[]
  fitHighlightedRoute?: boolean
  highlightedRouteColor?: string
  highlightedRoutes?: readonly CommunityMapRoute[]
  onMarkerSelect?: (marker: CommunityMapMarker) => void
  onMapSelect?: (coordinate: Coordinate) => void
  onViewportChange?: (bounds: CommunityMapBounds) => void
  children?: ReactNode
  className?: string
  ariaLabel?: string
}

const EMPTY_ROUTES: readonly MapRoute[] = []
const DEFAULT_CENTER: Coordinate = [126.977, 37.659]
const MARKER_CLUSTER_DISTANCE = 45
const INDIVIDUAL_OVERLAP_DISTANCE = 30
const OVERLAP_RELEASE_ZOOM = 16
const CLUSTER_CHOICE_ZOOM = OVERLAP_RELEASE_ZOOM - 0.5
const CLUSTER_CHOICE_MIN_ZOOM = 15

type ProjectedMarker = { marker: CommunityMapMarker; x: number; y: number; mapX: number; mapY: number }
type ClusterChoiceState = { key: string; markers: CommunityMapMarker[]; align: 'left' | 'right' }
type MarkerPlacement = { key: string; group: ProjectedMarker[]; coordinate: Coordinate; offset: [number, number]; element: HTMLDivElement }

const markerIdentity = (marker: CommunityMapMarker) => `${marker.kind}:${marker.id}`
const clusterIdentity = (group: readonly ProjectedMarker[]) => group.map(item => markerIdentity(item.marker)).sort().join('|')

function groupNearbyMarkers(markers: readonly ProjectedMarker[], distance: number, useMapDistance = false) {
  return groupCommunityMapPoints([...markers]
    .filter(({ marker }) => marker.kind !== 'mountain')
    .sort((left, right) => markerIdentity(left.marker).localeCompare(markerIdentity(right.marker)))
    .map(item => ({ value: item, x: useMapDistance ? item.mapX : item.x, y: useMapDistance ? item.mapY : item.y })), distance)
    .map(group => group.map(point => point.value))
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

export function CommunityMap({ markers = [], overviewMarker, mountainId, center = DEFAULT_CENTER, focusTarget, zoom = 14, showRoute = true, showMountainFlag = false, showMountainLabel = true,
  highlightedRoute, fitHighlightedRoute = false, highlightedRouteColor, highlightedRoutes, onMarkerSelect, onMapSelect, onViewportChange, children, className, ariaLabel = '커뮤니티 예시 지도' }: Props) {
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [projected, setProjected] = useState<ProjectedMarker[]>([])
  const [markerMode, setMarkerMode] = useState(() => communityMarkerMode(zoom))
  const [clusterChoice, setClusterChoice] = useState<ClusterChoiceState | null>(null)
  const clusterChoicesRef = useRef<HTMLDivElement>(null)
  const [mapUnavailable, setMapUnavailable] = useState(false)
  const [mapRetry, setMapRetry] = useState(0)
  const [dimension, setDimension] = useState<MapDimension>('2D')
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus>('idle')
  const mapLibreMarkers = useRef<Map<string, Marker>>(new Map())
  const [markerElements] = useState(() => new Map<string, HTMLDivElement>())
  const isMainMap = className?.includes('community-page__map--main') ?? false
  const wasMainMap = useRef(isMainMap)
  const mainMapViewport = useRef<{ center: Coordinate; zoom: number; bearing: number; pitch: number } | null>(null)
  const terrainEnabled = supportsTerrain(mountainId ?? overviewMarker?.id)
  const onReady = useCallback((instance: MapLibreMap | null) => { setMap(instance); if (instance) setMapUnavailable(false) }, [])
  const markerSignature = [...markers, ...(overviewMarker ? [overviewMarker] : [])]
    .map(marker => `${markerIdentity(marker)}:${marker.coordinate.join(',')}:${marker.selected}`).join('|')
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
      const worldSize = 512 * 2 ** map.getZoom()
      setProjected(visibleMarkers.map(marker => {
        const point = map.project(marker.coordinate)
        const mapPoint = MercatorCoordinate.fromLngLat(marker.coordinate)
        return { marker, x: point.x, y: point.y, mapX: mapPoint.x * worldSize, mapY: mapPoint.y * worldSize }
      }))
    }
    const observer = new ResizeObserver(() => { map.resize(); update() })
    observer.observe(map.getContainer())
    map.on('moveend', update)
    map.on('resize', update)
    update()
    return () => { observer.disconnect(); map.off('moveend', update); map.off('resize', update) }
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
    const leavingMainMap = !isMainMap && wasMainMap.current
    const returningToMainMap = isMainMap && !wasMainMap.current
    if (leavingMainMap) {
      const center = map.getCenter()
      mainMapViewport.current = { center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }
    }
    wasMainMap.current = isMainMap
    if (returningToMainMap && mainMapViewport.current) {
      map.easeTo({ ...mainMapViewport.current,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350 })
      return
    }
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
    const focusY = className.includes('community-page__map--detail-mountain')
      ? window.matchMedia('(max-height: 720px)').matches ? 154 : 160
      : className.includes('community-page__map--mountain-focus')
        ? Math.max(visibleTop + 44, Math.min(visibleCenter - 28, visibleTop + 48)) : visibleCenter
    map.easeTo({ center: focusTarget.coordinate, offset: [0, focusY - mapHeight / 2],
      zoom: focusTarget.zoom === undefined ? map.getZoom() : focusTarget.resetZoom
        ? focusTarget.zoom : Math.max(map.getZoom(), focusTarget.zoom),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550,
      easing: progress => 1 - (1 - progress) ** 3 })
  }, [map, focusTarget, className, highlightedRoute, isMainMap])

  useEffect(() => {
    if (!map || !onMapSelect) return
    const select = (event: { lngLat: { lng: number; lat: number } }) => onMapSelect([event.lngLat.lng, event.lngLat.lat])
    map.on('click', select)
    return () => { map.off('click', select) }
  }, [map, onMapSelect])

  useEffect(() => {
    if (!map || !onViewportChange) return
    let lastReportedCamera: { longitude: number; latitude: number; zoom: number } | null = null
    const report = () => {
      const center = map.getCenter()
      const zoom = map.getZoom()
      if (lastReportedCamera
        && Math.abs(lastReportedCamera.longitude - center.lng) < 0.000001
        && Math.abs(lastReportedCamera.latitude - center.lat) < 0.000001
        && Math.abs(lastReportedCamera.zoom - zoom) < 0.001) return
      lastReportedCamera = { longitude: center.lng, latitude: center.lat, zoom }
      const bounds = map.getBounds()
      onViewportChange({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() })
    }
    map.on('moveend', report)
    if (map.loaded()) report()
    else map.once('load', report)
    return () => { map.off('moveend', report); map.off('load', report) }
  }, [map, onViewportChange])

  useEffect(() => {
    if (clusterChoice) clusterChoicesRef.current?.querySelector<HTMLButtonElement>('.community-map__cluster-choice')?.focus()
  }, [clusterChoice])

  useEffect(() => {
    if (!clusterChoice) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)
        || clusterChoicesRef.current?.contains(target)
        || markerElements.get(clusterChoice.key)?.contains(target)) return
      setClusterChoice(null)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress)
  }, [clusterChoice, markerElements])

  const currentZoom = map?.getZoom() ?? zoom
  const markerGroups = isMainMap && markerMode !== 'overview'
    ? markerMode === 'individual' && currentZoom >= OVERLAP_RELEASE_ZOOM
      ? projected.filter(({ marker }) => marker.kind !== 'mountain').map(item => [item])
      : groupNearbyMarkers(projected, markerMode === 'cluster' ? MARKER_CLUSTER_DISTANCE : INDIVIDUAL_OVERLAP_DISTANCE, markerMode === 'cluster')
    : projected.filter(({ marker }) => marker.kind !== 'mountain').map(item => [item])
  const mountainMarkers = projected.filter(({ marker }) => marker.kind === 'mountain')
  const displayedGroups = [...mountainMarkers.map(item => [item]), ...markerGroups]
  displayedGroups.forEach(group => {
    const key = clusterIdentity(group)
    if (!markerElements.has(key)) markerElements.set(key, document.createElement('div'))
  })
  const markerPlacements = displayedGroups.map<MarkerPlacement>(group => {
    const key = clusterIdentity(group)
    const x = group.reduce((total, item) => total + item.x, 0) / group.length
    const y = group.reduce((total, item) => total + item.y, 0) / group.length
    const coordinate: Coordinate = group.length === 1 ? group[0].marker.coordinate : [
      group.reduce((total, item) => total + item.marker.coordinate[0], 0) / group.length,
      group.reduce((total, item) => total + item.marker.coordinate[1], 0) / group.length,
    ]
    const naturalPoint = map?.project(coordinate)
    return { key, group, coordinate, offset: group.length > 1 && naturalPoint ? [x - naturalPoint.x, y - naturalPoint.y] : [0, 0], element: markerElements.get(key)! }
  })

  useEffect(() => {
    if (!map) return
    const liveKeys = new Set(markerPlacements.map(placement => placement.key))
    markerPlacements.forEach(({ key, coordinate, offset, element }) => {
      let marker = mapLibreMarkers.current.get(key)
      if (!marker || marker.getElement() !== element) {
        marker?.remove()
        marker = new Marker({ element, anchor: 'center', opacityWhenCovered: 0.2, subpixelPositioning: true })
          .setLngLat(coordinate).setOffset(offset).addTo(map)
        mapLibreMarkers.current.set(key, marker)
        return
      }
      const lngLat = marker.getLngLat()
      if (lngLat.lng !== coordinate[0] || lngLat.lat !== coordinate[1]) marker.setLngLat(coordinate)
      const currentOffset = marker.getOffset()
      if (Math.abs(currentOffset.x - offset[0]) > 0.1 || Math.abs(currentOffset.y - offset[1]) > 0.1) marker.setOffset(offset)
    })
    mapLibreMarkers.current.forEach((marker, key) => {
      if (!liveKeys.has(key)) { marker.remove(); mapLibreMarkers.current.delete(key); markerElements.delete(key) }
    })
  }, [map, markerElements, markerPlacements])

  useEffect(() => {
    const markersOnMap = mapLibreMarkers.current
    return () => { markersOnMap.forEach(marker => marker.remove()); markersOnMap.clear() }
  }, [map])

  const expandCluster = (group: readonly ProjectedMarker[]) => {
    if (!map) return
    const center: Coordinate = [
      group.reduce((total, item) => total + item.marker.coordinate[0], 0) / group.length,
      group.reduce((total, item) => total + item.marker.coordinate[1], 0) / group.length,
    ]
    const targetZoom = Math.min(CLUSTER_CHOICE_ZOOM, map.getMaxZoom())
    if (map.getZoom() < CLUSTER_CHOICE_MIN_ZOOM) {
      setClusterChoice(null)
      const { visibleCenter, mapHeight } = visibleMapArea(map)
      map.easeTo({ center, offset: [0, visibleCenter - mapHeight / 2], zoom: targetZoom,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220 })
      return
    }
    const x = group.reduce((total, item) => total + item.x, 0) / group.length
    const containerRect = map.getContainer().getBoundingClientRect()
    const pageRect = map.getContainer().closest<HTMLElement>('.community-page')?.getBoundingClientRect() ?? containerRect
    const markerX = containerRect.left + x
    const rightSpace = pageRect.right - 12 - markerX
    const leftSpace = markerX - pageRect.left - 12
    setClusterChoice({ key: clusterIdentity(group), markers: group.map(item => item.marker),
      align: rightSpace >= 183 || rightSpace >= leftSpace ? 'right' : 'left' })
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
    {markerPlacements.map(({ key: groupKey, group, element }) => {
      const choiceOpen = clusterChoice?.key === groupKey
      return createPortal(<div
        className={`community-map__pin ${group.length > 1 ? 'community-map__pin--cluster' : `community-map__pin--${group[0].marker.kind}`}${choiceOpen ? ' community-map__pin--cluster-choice' : ''}${group.length === 1 && group[0].marker.selected ? ' community-map__pin--selected' : ''}`}>
        {group.length > 1 ? <>
          <button type="button" className="community-map__cluster"
            aria-label={`겹친 지도 항목 ${group.length}개 ${markerMode === 'individual' ? '목록 보기' : '확대 또는 목록 보기'}`} onClick={() => expandCluster(group)}><span>{group.length}</span></button>
          {choiceOpen && <div ref={clusterChoicesRef} className={`community-map__cluster-choices community-map__cluster-choices--${clusterChoice.align}`}
            role="dialog" aria-label="겹친 지도 항목 선택" onKeyDown={event => { if (event.key === 'Escape') setClusterChoice(null) }}>
            <button type="button" className="community-map__cluster-close" onClick={() => setClusterChoice(null)} aria-label="목록 닫기">×</button>
            <strong>이 위치의 항목</strong>{clusterChoice.markers.map(marker => <button type="button" className="community-map__cluster-choice" key={markerIdentity(marker)} onClick={() => { onMarkerSelect?.(marker); setClusterChoice(null) }}>{marker.name}</button>)}
          </div>}
        </> : group.map(({ marker }) => <span key={markerIdentity(marker)}>
        {marker.kind === 'mountain'
          ? <span className={`community-map__mountain-marker${showMountainLabel ? '' : ' community-map__mountain-marker--label-hidden'}`}>{showMountainFlag && <img src={mountainFlag} alt="" aria-hidden="true" className="community-map__mountain-flag" />}
              <MountainMarker name={marker.name} variant="point" selected={marker.selected} aria-label={`${marker.name} 선택`} onClick={() => onMarkerSelect?.(marker)} />
            </span>
          : marker.kind === 'spot' && marker.spotType !== 'other'
            ? <SpotMarker kind={marker.spotType ?? 'photo'} label={marker.name} aria-pressed={marker.selected}
                aria-label={`${marker.targetType === 'FACILITY' ? '공식 시설' : '사용자 스팟'} ${marker.name} 선택`} onClick={() => onMarkerSelect?.(marker)} />
            : <button type="button" className={`community-map__custom-marker community-map__custom-marker--${marker.kind}`}
                style={marker.color ? { '--community-course-color': marker.color } as CSSProperties : undefined}
                aria-label={`${marker.name} 선택`} aria-pressed={marker.selected} onClick={() => onMarkerSelect?.(marker)}>
                <span className="community-map__custom-symbol">{marker.shortLabel ?? <Icon name="Pin" size={18} />}</span>
                {marker.kind !== 'point' && marker.kind !== 'course' && <span className="community-map__custom-label">{marker.label ?? marker.name}</span>}
              </button>}
      </span>)}
      </div>, element, groupKey)
    })}
    {children}
  </div>
}
