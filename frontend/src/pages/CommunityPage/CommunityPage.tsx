import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/common/Button'
import { Icon } from '../../components/common/Icon'
import { Chip } from '../../components/common/Chip'
import { BottomNavigation, TopBar, type BottomDestination } from '../../components/layout'
import { BottomSheet, ModalLayer } from '../../components/overlay'
import { EmptyState, Toast } from '../../components/feedback'
import { communityCourse, communityMountains, communityReviewExamples, communitySegment, communitySegments, communitySpots } from '../../api/communityMock'
import type { CommunityReview, CommunitySegment, Coordinate, ReviewDraft, ReviewKind, SpotType } from '../../types/community'
import { useCommunityData, setCommunitySpots as setSpots, setCommunityReviews as setReviews, setCommunityVotes as setVotes, setCommunitySegmentVotes as setSegmentVotes } from '../../store/communityStore'
import { getNickname } from '../../store/profileStore'
import { canWriteReview, castSpotVote, distanceMeters, isSpotHidden, resolveSegmentStatus } from '../../utils/community'
import { CommunityMap, type CommunityMapMarker } from './components/CommunityMap'
import { CommunityPhotoAlbum, CommunityPhotoReview, CommunityPhotoStrip, type CommunityGalleryPhoto } from './components/SpotPhotoGallery'
import { ReviewForm } from './components/ReviewForm'
import { SpotRegistration } from './components/SpotRegistration'
import { SpotTypeDropdown } from './components/SpotTypeDropdown'
import { useCommunitySheet } from './hooks/useCommunitySheet'
import mountainExample from './assets/mountain-example.webp'
import spotExample from './assets/spot-example.webp'
import segmentExample from './assets/segment-example.webp'
import './community.css'

export type CommunityScreen = 'mountainSelect' | 'map' | 'mountainDetail' | 'spotDetail' | 'segmentDetail' | 'mountainReviewList' | 'spotReviewList' | 'segmentReviewList' | 'review' | 'spotPicker' | 'segmentPicker' | 'newSpot' | 'photoAlbum' | 'photoReview'
type MapCategory = 'all' | ReviewKind
type SegmentStage = 'start' | 'via' | 'end'

export type CommunityPageProps = {
  initialScreen?: CommunityScreen
  initialMountainId?: string
  initialSpotId?: string
  onSpotRegistered?: () => void
  readOnly?: boolean
  completedHike?: { mountainId: string; finishedAt: string }
  onExit?: () => void
  onNavigateOutside?: (destination: BottomDestination) => void
}

const mountainReviewCount = 128
const mountainExampleRatings = [5, 4, 5] as const
const spotExampleReviewIndices = [0, 2, 4, 6, 7, 9, 11, 13] as const
const exampleReviewDate = (index: number) => `9월 ${17 - index}일`
const reviewRuleMessage = '산행 완료 후 24시간 이내에만 후기 작성 가능'
const MOUNTAIN_SELECT_CENTER: Coordinate = [126.99, 37.57]
const MAIN_MAP_ZOOM = 14
const CATEGORY_MAP_ZOOM: Record<MapCategory, number> = { all: MAIN_MAP_ZOOM, mountain: 15, spot: 14.7, segment: 14.5 }
const segmentIllustrations = [mountainExample, segmentExample, spotExample]
function segmentCenter(segment: CommunitySegment): Coordinate {
  return segment.coordinates[Math.floor(segment.coordinates.length / 2)]
}

function coordinatesCenter(coordinates: readonly Coordinate[], fallback: Coordinate): Coordinate {
  if (coordinates.length === 0) return fallback
  return [coordinates.reduce((sum, point) => sum + point[0], 0) / coordinates.length,
    coordinates.reduce((sum, point) => sum + point[1], 0) / coordinates.length]
}

function nearestSegment(path: readonly Coordinate[]): CommunitySegment {
  const center = path[Math.floor(path.length / 2)]
  return communitySegments.reduce((nearest, segment) => distanceMeters(segmentCenter(segment), center) < distanceMeters(segmentCenter(nearest), center)
    ? segment : nearest, communitySegment)
}

function blankDraft(kind: ReviewKind, targetId: string): ReviewDraft {
  return { kind, targetId, content: '', photos: [], rating: 0, status: null }
}

function ReviewQuotes({ reviews, seedQuotes = [], scrollable = false, limit, showRating = false, photos, onPhotoOpen }: {
  reviews: readonly CommunityReview[]
  seedQuotes?: readonly string[]
  scrollable?: boolean
  limit?: number
  showRating?: boolean
  photos?: readonly CommunityGalleryPhoto[]
  onPhotoOpen?: (id: string) => void
}) {
  if (reviews.length === 0 && seedQuotes.length === 0) return <EmptyState showIcon={false} title="아직 등록된 후기가 없어요." description="" className="community-empty" />
  const shownReviews = reviews.slice(0, limit)
  const shownSeedQuotes = seedQuotes.slice(0, limit === undefined ? undefined : Math.max(0, limit - shownReviews.length))
  const examplePhotos = photos?.filter(photo => photo.source === 'example') ?? []
  const thumbnail = (photo: CommunityGalleryPhoto | undefined, label: string) => photo?.src && onPhotoOpen
    ? <button type="button" className="community-quote__photo" aria-label={`${label} 사진 크게 보기`} onClick={() => onPhotoOpen(photo.id)}>
      <img src={photo.src} alt="" loading="lazy" /></button> : null
  return <div className={`community-quote-list${scrollable ? ' community-quote-list--scrollable' : ''}`} role={scrollable ? 'region' : undefined}
    aria-label={scrollable ? '산 후기 목록' : undefined} tabIndex={scrollable ? 0 : undefined}>
    {shownReviews.map(review => <div key={review.id} className="community-quote"><div className="community-quote__row">
      {thumbnail(photos?.find(photo => photo.review?.id === review.id), '내 후기')}
      <div className="community-quote__text">{showRating
        ? <span className="community-quote__meta community-quote__meta--mountain"><span>{review.author ?? '나'}</span>{review.rating != null && <strong>★ {review.rating.toFixed(1)}</strong>}<time dateTime={review.createdAt}>{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(review.createdAt))}</time></span>
        : <span>{review.author ?? '나'} · 방금 전</span>}
        {review.segmentCoordinates && <small className="community-quote__segment">선택 구간 · {review.segmentCoordinates.length}개 경로 지점{review.segmentVia ? ' · 경유지 포함' : ''}</small>}
        <p>{review.content}</p>
        {review.status && <span className={`community-status-pill community-status-pill--${review.status}`}>{review.status === 'good' ? '양호' : review.status === 'caution' ? '주의 필요' : '위험'}</span>}</div>
    </div></div>)}
    {shownSeedQuotes.map((quote, index) => <div key={`${index}-${quote}`} className="community-quote"><div className="community-quote__row">
      {thumbnail(examplePhotos.find(photo => photo.exampleText === quote), '등산객 후기')}
      <div className="community-quote__text">{showRating
        ? <span className="community-quote__meta community-quote__meta--mountain"><span>등산객</span><strong>★ {mountainExampleRatings[index % mountainExampleRatings.length].toFixed(1)}</strong><time>{exampleReviewDate(index)}</time></span>
        : <span>등산객 · {exampleReviewDate(index)}</span>}
        <p>{quote}</p></div>
    </div></div>)}
  </div>
}

function EmptyReviewPreview({ mountainName, kind, message }: { mountainName: string; kind: 'spot' | 'segment'; message?: string }) {
  return <div className="af-review-preview community-empty-preview" role="status">
    <span className="af-review-preview__icon" aria-hidden="true"><Icon name={kind === 'spot' ? 'Photo' : 'Pin'} size={24} color="currentColor" /></span>
    <span className="af-review-preview__copy"><span className="af-review-preview__mountain">{mountainName}</span>
      <span className="af-review-preview__rating">{message ?? (kind === 'spot' ? '표시할 스팟이 없어요' : '표시할 구간이 없어요')}</span></span>
  </div>
}

function ReviewEligibilityInfo() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    const closeOutsideClick = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('click', closeOutsideClick)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('click', closeOutsideClick) }
  }, [open])
  return <span ref={rootRef} className="community-review-info" data-open={open}>
    <button type="button" className="community-review-info__button" aria-label="후기 작성 조건" aria-expanded={open}
      aria-describedby="community-review-rule" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
      onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.blur() } }}>
      <span aria-hidden="true">!</span>
    </button>
    <span id="community-review-rule" role="tooltip" className="community-review-info__tooltip">{reviewRuleMessage}</span>
  </span>
}

export function CommunityPage({ initialScreen = 'mountainSelect', initialMountainId = 'bukhansan', initialSpotId, onSpotRegistered, readOnly = false, completedHike, onExit, onNavigateOutside }: CommunityPageProps) {
  const [screens, setScreens] = useState<CommunityScreen[]>([initialScreen])
  const screen = screens.at(-1)!
  const isDetail = screen === 'mountainDetail' || screen === 'spotDetail' || screen === 'segmentDetail'
  const [mountainId, setMountainId] = useState(initialMountainId)
  const [mountainFocus, setMountainFocus] = useState<{ coordinate: Coordinate; request: number } | null>(null)
  const [mapCategory, setMapCategory] = useState<MapCategory>('all')
  const [categoryFocusRequest, setCategoryFocusRequest] = useState(1)
  const [spotTypeFilter, setSpotTypeFilter] = useState<SpotType | 'all'>('all')
  const inlineMountainDetail = screen === 'map' && mapCategory === 'mountain'
  const [reviewKindPickerOpen, setReviewKindPickerOpen] = useState(false)
  const mapScrollTop = useRef(0)
  const reviewPickerRef = useRef<HTMLElement>(null)
  const { spots, reviews, votes, segmentVotes } = useCommunityData()
  const [detailSpotId, setDetailSpotId] = useState(initialSpotId ?? communitySpots[0].id)
  const [detailSegmentId, setDetailSegmentId] = useState(communitySegment.id)
  const [galleryPhotoId, setGalleryPhotoId] = useState<string | null>(null)
  const [galleryKind, setGalleryKind] = useState<ReviewKind>('spot')
  const [lightboxPhoto, setLightboxPhoto] = useState<CommunityGalleryPhoto | null>(null)
  const [detailSpotFocus, setDetailSpotFocus] = useState<{ coordinate: Coordinate; request: number; zoom: number } | null>(null)
  const [draft, setDraft] = useState<ReviewDraft>(() => blankDraft('mountain', initialMountainId))
  const [pickerSpotId, setPickerSpotId] = useState<string | null>(null)
  const [segmentStage, setSegmentStage] = useState<SegmentStage>('start')
  const [segmentStart, setSegmentStart] = useState<number | null>(null)
  const [segmentVia, setSegmentVia] = useState<number | null>(null)
  const [segmentEnd, setSegmentEnd] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const toastId = useRef(0)
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const detailSpotForHeight = spots.find(spot => spot.id === detailSpotId)
  const compactEmptySpot = screen === 'spotDetail' && !!detailSpotForHeight && !isSpotHidden(votes[detailSpotId])
    && detailSpotForHeight.baselinePhotos === 0 && detailSpotForHeight.photos.length === 0
    && detailSpotForHeight.baselineReviews === 0 && !detailSpotForHeight.seedQuote
    && !reviews.some(review => review.kind === 'spot' && review.targetId === detailSpotId)
  const { rootRef, style: sheetStyle, peek: sheetPeek, level: sheetLevel, reset: resetSheet, handleProps } = useCommunitySheet(isDetail || inlineMountainDetail, screen === 'map' && !inlineMountainDetail, compactEmptySpot)
  useLayoutEffect(() => {
    if (screen !== 'map') return
    const content = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet--map .af-bottom-sheet__content')
    if (!content) return
    content.scrollTop = mapScrollTop.current
    const saveScroll = () => { mapScrollTop.current = content.scrollTop }
    content.addEventListener('scroll', saveScroll, { passive: true })
    return () => content.removeEventListener('scroll', saveScroll)
  }, [screen, mapCategory, rootRef])
  useEffect(() => {
    if (!reviewKindPickerOpen) return
    const trigger = document.activeElement as HTMLElement | null
    reviewPickerRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }) }
  }, [reviewKindPickerOpen])
  useEffect(() => { const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const heading = rootRef.current?.querySelector<HTMLElement>('.af-top-bar__title')
      heading?.setAttribute('tabindex', '-1')
      heading?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [screen, rootRef])
  const mountain = communityMountains.find(item => item.id === mountainId) ?? communityMountains[0]
  const selectMountain = (id: string) => {
    const selected = communityMountains.find(item => item.id === id)
    if (!selected) return
    setMountainId(id)
    setMountainFocus(current => ({ coordinate: selected.position as Coordinate, request: (current?.request ?? 0) + 1 }))
  }
  const visibleSpots = useMemo(() => spots.filter(spot => spot.mountainId === mountainId && !isSpotHidden(votes[spot.id])), [spots, votes, mountainId])
  const filteredSpots = useMemo(() => mapCategory === 'spot' && spotTypeFilter !== 'all'
    ? visibleSpots.filter(spot => spot.type === spotTypeFilter) : visibleSpots, [mapCategory, spotTypeFilter, visibleSpots])
  const mapFocus = useMemo(() => {
    const mountainCenter = mountain.position as Coordinate
    const overviewCenter = mountainId === 'bukhansan' ? segmentCenter(communitySegment) : mountainCenter
    const coordinate = mapCategory === 'mountain' ? mountainCenter
      : mapCategory === 'spot' ? coordinatesCenter(filteredSpots.map(spot => spot.coordinate), overviewCenter)
        : mapCategory === 'segment' && mountainId === 'bukhansan'
          ? coordinatesCenter(communitySegments.map(segmentCenter), overviewCenter) : overviewCenter
    return { coordinate, request: categoryFocusRequest, zoom: CATEGORY_MAP_ZOOM[mapCategory], resetZoom: true }
  }, [mountainId, mountain.position, mapCategory, categoryFocusRequest, filteredSpots])
  const selectedSpot = spots.find(spot => spot.id === detailSpotId)
  const selectedSegment = communitySegments.find(segment => segment.id === detailSegmentId) ?? communitySegment
  const selectedSegmentIndex = communitySegments.indexOf(selectedSegment)
  const mountainDetailFocus = useMemo(() => ({ coordinate: mountain.position as Coordinate, request: 1, zoom: CATEGORY_MAP_ZOOM.mountain, resetZoom: true }), [mountain.position])
  const segmentDetailFocus = useMemo(() => ({ coordinate: segmentCenter(selectedSegment), request: 1, zoom: 16 }), [selectedSegment])
  const segmentVote = segmentVotes[selectedSegment.id] ?? { yes: 0, no: 0, viewer: null }
  const selectedSpotHidden = selectedSpot ? isSpotHidden(votes[selectedSpot.id]) : false
  useEffect(() => {
    if (screen !== 'spotDetail' || !selectedSpotHidden) return
    const frame = window.requestAnimationFrame(() => {
      const heading = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet .af-empty-state__title')
      heading?.setAttribute('tabindex', '-1')
      heading?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [screen, selectedSpotHidden, rootRef])
  const draftSpot = spots.find(spot => spot.id === draft.targetId)
  const currentReviews = (kind: ReviewKind, targetId: string) => reviews.filter(review => review.kind === kind && review.targetId === targetId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const mountainReviews = currentReviews('mountain', mountainId)
  const hasMountainBaseline = mountainId === 'bukhansan'
  const mountainReviewTotal = (hasMountainBaseline ? mountainReviewCount : 0) + mountainReviews.length
  const mountainRating = mountainReviewTotal > 0
    ? ((hasMountainBaseline ? mountainReviewCount * 4.6 : 0) + mountainReviews.reduce((sum, review) => sum + (review.rating ?? 0), 0)) / mountainReviewTotal
    : null
  const mountainPhotos = mountainReviews.flatMap(review => review.photos)
  const mountainPhotoTotal = (hasMountainBaseline ? 3 : 0) + mountainPhotos.length
  const reviewEligible = canWriteReview(completedHike, mountainId, currentTime)
  const reviewEligibilityMessage = completedHike?.mountainId === mountainId
    ? '산행 완료 후 24시간이 지나 후기 작성 기간이 끝났어요.' : '이 산의 완료된 산행이 있어야 후기를 작성할 수 있어요.'
  const selectedSpotReviews = selectedSpot ? currentReviews('spot', selectedSpot.id) : []
  const spotGalleryPhotos: CommunityGalleryPhoto[] = selectedSpot ? [
    ...selectedSpotReviews.flatMap(review => review.photos.map((src, index) => ({ id: `${review.id}-${index}`, src, review, source: 'review' as const }))),
    ...selectedSpot.photos.map((src, index) => ({ id: `spot-${selectedSpot.id}-${index}`, src, source: 'spot' as const })),
    ...Array.from({ length: selectedSpot.baselinePhotos }, (_, index) => {
      const quoteIndex = selectedSpot.id === 'baegundae-rock' ? spotExampleReviewIndices[index % spotExampleReviewIndices.length]
        : index % (communityReviewExamples[selectedSpot.id]?.length || 1)
      return { id: `example-${selectedSpot.id}-${index}`, src: [spotExample, mountainExample, segmentExample][index % 3],
        exampleText: communityReviewExamples[selectedSpot.id]?.[quoteIndex], exampleDate: exampleReviewDate(quoteIndex), source: 'example' as const }
    }),
  ] : []
  const segmentReviews = currentReviews('segment', selectedSegment.id)
  const mountainGalleryPhotos: CommunityGalleryPhoto[] = [
    ...mountainReviews.flatMap(review => review.photos.map((src, index) => ({ id: `${review.id}-${index}`, src, review, source: 'review' as const }))),
    ...(hasMountainBaseline ? [mountainExample, spotExample, segmentExample].map((src, index) => ({ id: `mountain-example-${index}`, src,
      exampleText: communityReviewExamples.bukhansan[index], exampleRating: mountainExampleRatings[index],
      exampleDate: exampleReviewDate(index), source: 'example' as const })) : []),
  ]
  const segmentGalleryPhotos: CommunityGalleryPhoto[] = [
    ...segmentReviews.flatMap(review => review.photos.map((src, index) => ({ id: `${review.id}-${index}`, src, review, source: 'review' as const }))),
    ...Array.from({ length: selectedSegment.baselinePhotos }, (_, index) => ({ id: `segment-example-${selectedSegment.id}-${index}`,
      src: segmentIllustrations[(selectedSegmentIndex + index) % segmentIllustrations.length],
      exampleText: communityReviewExamples[selectedSegment.id]?.[index % communityReviewExamples[selectedSegment.id].length],
      exampleDate: exampleReviewDate(index % 3), source: 'example' as const })),
  ]
  const galleryPhotos = galleryKind === 'mountain' ? mountainGalleryPhotos : galleryKind === 'segment' ? segmentGalleryPhotos : spotGalleryPhotos
  const galleryTitle = galleryKind === 'mountain' ? mountain.name : galleryKind === 'segment' ? selectedSegment.name : selectedSpot?.name ?? '스팟'
  const selectedGalleryIndex = galleryPhotos.findIndex(photo => photo.id === galleryPhotoId)
  const selectedGalleryPhoto = galleryPhotos[selectedGalleryIndex]
  const segmentStatus = resolveSegmentStatus(segmentReviews, selectedSegment.baselineStatus)
  const move = (next: CommunityScreen) => { setErrors({}); setReviewKindPickerOpen(false); resetSheet(); setScreens(current => [...current, next]) }
  const confirmMountainSelection = () => {
    mapScrollTop.current = 0
    setMapCategory('all')
    setSpotTypeFilter('all')
    move('map')
  }
  const back = () => {
    setErrors({})
    resetSheet()
    if (screens.length === 1) { onExit?.(); return }
    setScreens(current => current.slice(0, -1))
  }
  const notify = (message: string) => {
    const id = ++toastId.current
    setToast({ id, message })
    window.setTimeout(() => setToast(current => current?.id === id ? null : current), 2800)
  }
  const registerReview = (start: () => void) => {
    if (!canWriteReview(completedHike, mountainId)) { notify('산행 완료 후 24시간 이내에만 후기를 작성할 수 있습니다.'); return }
    start()
  }
  const showDetail = (kind: ReviewKind, targetId?: string) => {
    if (screen === 'map') mapScrollTop.current = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet--map .af-bottom-sheet__content')?.scrollTop ?? mapScrollTop.current
    if (kind === 'spot' && targetId) focusSpot(targetId)
    if (kind === 'segment' && targetId) setDetailSegmentId(targetId)
    move(kind === 'mountain' ? 'mountainDetail' : kind === 'spot' ? 'spotDetail' : 'segmentDetail')
  }
  const changeMapCategory = (category: MapCategory) => {
    mapScrollTop.current = 0
    setReviewKindPickerOpen(false)
    resetSheet()
    setMapCategory(category)
    setCategoryFocusRequest(current => current + 1)
    const content = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet--map .af-bottom-sheet__content')
    if (content) content.scrollTop = 0
  }
  const changeSpotTypeFilter = (type: SpotType | 'all') => {
    setSpotTypeFilter(type)
    mapScrollTop.current = 0
    const content = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet--map .af-bottom-sheet__content')
    if (content) content.scrollTop = 0
  }
  const openGalleryPhoto = (kind: ReviewKind, id: string) => { setGalleryKind(kind); setGalleryPhotoId(id); move('photoReview') }
  const openGallery = (kind: ReviewKind) => { setGalleryKind(kind); move('photoAlbum') }
  const focusSpot = (id: string) => {
    const spot = spots.find(item => item.id === id)
    if (!spot) return
    setDetailSpotId(id)
    setDetailSpotFocus(current => ({ coordinate: spot.coordinate, request: (current?.request ?? 0) + 1, zoom: 16 }))
  }
  const beginReview = (kind: ReviewKind, targetId: string) => {
    if (!canWriteReview(completedHike, mountainId)) { notify(reviewEligibilityMessage); return }
    setDraft(blankDraft(kind, targetId))
    move('review')
  }
  const startMapReview = (kind: ReviewKind) => {
    if (kind === 'mountain') beginReview('mountain', mountainId)
    else if (kind === 'spot') { setPickerSpotId(null); setDraft(blankDraft('spot', '')); move('spotPicker') }
    else if (mountainId !== 'bukhansan') notify('이 산의 구간 목데이터는 아직 준비되지 않았어요.')
    else { setDraft(blankDraft('segment', communitySegment.id)); setSegmentStart(null); setSegmentEnd(null); setSegmentVia(null); setSegmentStage('start'); move('segmentPicker') }
  }
  const updateDraft = (patch: Partial<ReviewDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
    setErrors(current => { const next = { ...current }; for (const key of Object.keys(patch)) delete next[key]; return next })
  }
  const submitReview = () => {
    if (!canWriteReview(completedHike, mountainId)) { notify(reviewEligibilityMessage); return }
    const next: Record<string, string> = {}
    if (draft.kind === 'mountain' && draft.rating === 0) next.rating = '평점을 선택해 주세요.'
    if (draft.kind === 'spot' && !spots.some(spot => spot.id === draft.targetId && !isSpotHidden(votes[spot.id]))) next.target = '후기를 남길 스팟을 선택해 주세요.'
    if (draft.kind === 'segment' && !draft.segmentCoordinates?.length) next.target = '구간을 선택해 주세요.'
    if (draft.kind === 'segment' && !draft.status) next.status = '구간 상태를 선택해 주세요.'
    if (!draft.content.trim()) next.content = '후기 내용을 입력해 주세요.'
    if (Object.keys(next).length) { setErrors(next); notify(Object.values(next)[0]); return }
    setReviews(current => [{ id: crypto.randomUUID(), kind: draft.kind, targetId: draft.targetId,
      content: draft.content.trim(), photos: draft.photos, rating: draft.kind === 'mountain' ? draft.rating : undefined,
      status: draft.status ?? undefined, segmentCoordinates: draft.kind === 'segment' ? draft.segmentCoordinates : undefined,
      segmentVia: draft.kind === 'segment' ? draft.segmentVia : undefined, author: getNickname(), createdAt: new Date().toISOString() }, ...current])
    setErrors({})
    const detail: CommunityScreen = draft.kind === 'mountain' ? 'mountainDetail' : draft.kind === 'spot' ? 'spotDetail' : 'segmentDetail'
    if (draft.kind === 'spot') focusSpot(draft.targetId)
    if (draft.kind === 'segment') setDetailSegmentId(draft.targetId)
    resetSheet()
    setScreens(['mountainSelect', 'map', detail])
    notify('후기를 등록했습니다. 현재 화면에서 확인할 수 있어요.')
  }
  const castVote = (choice: 'yes' | 'no') => {
    if (!selectedSpot || readOnly) return
    const next = castSpotVote(votes[selectedSpot.id] ?? { yes: 0, no: 0, viewer: null }, choice)
    setVotes(current => ({ ...current, [selectedSpot.id]: next }))
    notify(isSpotHidden(next) ? '부정 평가가 3건이 되어 이 스팟을 지도에서 숨겼어요. 평가를 취소하거나 변경할 수 있어요.' : '평가를 반영했어요. 같은 버튼을 다시 누르면 취소할 수 있어요.')
  }
  const castSegmentVote = (choice: 'yes' | 'no') => {
    if (readOnly) return
    setSegmentVotes(current => ({ ...current, [selectedSegment.id]: castSpotVote(current[selectedSegment.id] ?? { yes: 0, no: 0, viewer: null }, choice) }))
    notify('평가를 반영했어요. 같은 버튼을 다시 누르면 취소할 수 있어요.')
  }
  const mapMarkers: CommunityMapMarker[] = [
    ...(mapCategory === 'all' || mapCategory === 'mountain' ? [{ id: mountain.id, name: mountain.name, coordinate: mountain.position as Coordinate, kind: 'mountain' as const }] : []),
    ...(mapCategory === 'all' || mapCategory === 'spot' ? filteredSpots.map(spot => ({ id: spot.id, name: spot.name, coordinate: spot.coordinate, kind: 'spot' as const, spotType: spot.type })) : []),
    ...(mountainId === 'bukhansan' && (mapCategory === 'all' || mapCategory === 'segment')
      ? communitySegments.map(segment => ({ id: segment.id, name: segment.name, coordinate: segmentCenter(segment), kind: 'segment' as const })) : []),
  ]
  const pickSpotMarkers: CommunityMapMarker[] = visibleSpots.map(spot => ({ id: spot.id, name: spot.name,
    coordinate: spot.coordinate, kind: 'spot', spotType: spot.type, selected: pickerSpotId === spot.id }))
  const routePoints = [...communityCourse.routeCoordinates] as Coordinate[]
  const segmentMarkers: CommunityMapMarker[] = [
    ...(segmentStart !== null ? [{ id: 'start', name: '출발', shortLabel: '출', kind: 'point' as const, coordinate: routePoints[segmentStart] }] : []),
    ...(segmentVia !== null ? [{ id: 'via', name: '경유', shortLabel: '경', kind: 'point' as const, coordinate: routePoints[segmentVia] }] : []),
    ...(segmentEnd !== null ? [{ id: 'end', name: '도착', shortLabel: '도', kind: 'point' as const, coordinate: routePoints[segmentEnd] }] : []),
  ]
  function selectSegmentPoint(point: Coordinate) {
    const nearest = routePoints.reduce((best, coordinate, index) => distanceMeters(coordinate, point) < distanceMeters(routePoints[best], point) ? index : best, 0)
    if (segmentStage === 'start') { setSegmentStart(nearest); setSegmentEnd(null); setSegmentVia(null); setSegmentStage('end') }
    else if (segmentStart === null) notify('먼저 출발 지점을 선택해 주세요.')
    else if (segmentStage === 'via') { setSegmentVia(nearest); setSegmentStage('end') }
    else if (segmentVia !== null && (segmentVia < Math.min(segmentStart, nearest) || segmentVia > Math.max(segmentStart, nearest))) notify('경유지는 출발과 도착 사이에서 선택해 주세요.')
    else setSegmentEnd(nearest)
  }
  function confirmSegment() {
    if (segmentStart === null || segmentEnd === null || segmentStart === segmentEnd) { notify('출발과 도착을 다른 지점으로 선택해 주세요.'); return }
    const low = Math.min(segmentStart, segmentEnd), high = Math.max(segmentStart, segmentEnd)
    if (segmentVia !== null && (segmentVia < low || segmentVia > high)) { notify('경유지는 출발과 도착 사이에서 선택해 주세요.'); return }
    const between = routePoints.slice(low, high + 1)
    updateDraft({ kind: 'segment', targetId: nearestSegment(between).id, segmentCoordinates: segmentStart < segmentEnd ? between : between.reverse(),
      segmentVia: segmentVia === null ? undefined : routePoints[segmentVia] })
    back()
  }
  function handleBottomNavigation(destination: BottomDestination) {
    if (destination === 'community') { resetSheet(); setScreens(['mountainSelect', 'map']); return }
    if (onNavigateOutside) onNavigateOutside(destination)
    else notify('다른 탭과의 연결은 별도 라우팅 작업에서 진행합니다.')
  }
  const title = screen === 'mountainSelect' ? '산 선택' : screen === 'map' ? '커뮤니티 지도'
    : screen === 'mountainDetail' ? `${mountain.name} 후기` : screen === 'spotDetail' ? '스팟 상세' : screen === 'mountainReviewList' || screen === 'spotReviewList' || screen === 'segmentReviewList' ? '전체 후기'
      : screen === 'segmentDetail' ? '구간 상세' : screen === 'review' ? `${draft.kind === 'mountain' ? '산' : draft.kind === 'spot' ? '스팟' : '구간'} 후기 작성`
        : screen === 'spotPicker' ? '스팟 위치 선택' : screen === 'segmentPicker' ? '구간 선택'
          : screen === 'photoAlbum' ? '사진첩' : screen === 'photoReview' ? '사진 후기' : '새 스팟 등록'
  const mountainReviewContent = mountainRating === null
    ? <EmptyState showIcon={false} title="아직 등록된 후기가 없어요" description="이 산의 첫 후기를 남겨보세요." className="community-mountain-empty" />
    : <>
      {mountainPhotoTotal > 0 && <div className="community-detail-photos"><CommunityPhotoStrip kindLabel="산" photos={mountainGalleryPhotos}
        onViewAll={() => openGallery('mountain')} onOpen={id => openGalleryPhoto('mountain', id)} /></div>}
      <div className="community-review-heading"><strong>방문자 후기</strong>
        {(mountainReviews.length > 0 || hasMountainBaseline) &&
          <button type="button" onClick={() => move('mountainReviewList')}>후기 모두 보기 <Icon name="ChevronRight" size={16} /></button>}
      </div>
      <ReviewQuotes reviews={mountainReviews} seedQuotes={hasMountainBaseline ? communityReviewExamples.bukhansan : undefined} limit={5} showRating />
    </>
  const mountainHeaderScore = mountainRating !== null && <span className="community-detail-score">
    <span className="community-detail-score__summary"><span>★ {mountainRating.toFixed(1)}</span><small>후기 {mountainReviewTotal}</small></span>
    {hasMountainBaseline && <span className="community-detail-metrics">접근성 <strong>4.5</strong> · 경관 <strong>4.8</strong></span>}
  </span>
  return <main ref={rootRef} className="community-page" style={sheetStyle} aria-label={title}>
    <TopBar title={title} showLeading={screen !== 'mountainSelect' || Boolean(onExit)} showAction={false} onBack={back} className="community-page__topbar" />

    {screen === 'mountainSelect' && <>
      <CommunityMap className="community-page__map community-page__map--select" showRoute={false} center={MOUNTAIN_SELECT_CENTER} focusTarget={mountainFocus ?? undefined} zoom={9.5}
        markers={communityMountains.map(item => ({ id: item.id, name: item.name, kind: 'mountain', coordinate: item.position as Coordinate, selected: mountainId === item.id }))}
        onMarkerSelect={selectMountain} />
      <BottomSheet title="커뮤니티에서 볼 산을 선택해주세요" showClose={false}
        handleProps={handleProps} bodyHidden={sheetPeek}
        className={`community-page__sheet community-page__sheet--select${sheetPeek ? ' community-page__sheet--peek' : ''}`} content={<div className="community-mountain-chips">{communityMountains.map(item =>
          <Chip key={item.id} label={item.name} selected={mountainId === item.id} onClick={() => selectMountain(item.id)} />)}</div>}
        showFooter footer={<Button fullWidth label="선택 완료" onClick={confirmMountainSelection} />} />
    </>}

    {(screen === 'map' || isDetail) && <CommunityMap
      className={`community-page__map ${screen === 'map' ? `community-page__map--main${inlineMountainDetail ? ' community-page__map--mountain-focus' : ''}` : `community-page__map--detail community-page__map--detail-${screen === 'mountainDetail' ? 'mountain' : screen === 'spotDetail' ? 'spot' : 'segment'}`}`}
      center={mountain.position as Coordinate}
      zoom={MAIN_MAP_ZOOM}
      focusTarget={screen === 'map' ? mapFocus : screen === 'mountainDetail' ? mountainDetailFocus : screen === 'spotDetail' ? detailSpotFocus ?? undefined
        : screen === 'segmentDetail' ? segmentDetailFocus : undefined}
      showRoute={mountainId === 'bukhansan'}
      segmentLine={screen === 'segmentDetail' && mountainId === 'bukhansan'
        ? { coordinates: selectedSegment.coordinates, status: segmentStatus } : undefined}
      markers={screen === 'map' ? mapMarkers : screen === 'mountainDetail'
        ? [{ id: mountain.id, name: mountain.name, kind: 'mountain', coordinate: mountain.position as Coordinate }]
        : screen === 'spotDetail' ? visibleSpots.map(spot => ({ id: spot.id, name: spot.name, kind: 'spot' as const,
          coordinate: spot.coordinate, spotType: spot.type, selected: spot.id === selectedSpot?.id })) : []}
      onMarkerSelect={screen === 'spotDetail' ? focusSpot : screen === 'map' ? id => {
        if (id === mountain.id) showDetail('mountain', id)
        else if (communitySegments.some(segment => segment.id === id)) showDetail('segment', id)
        else showDetail('spot', id)
      } : undefined}>
      {screen === 'map' && <div className="community-map-filters" role="group" aria-label="지도와 후기 목록 유형 필터">
        {(['all', 'mountain', 'spot', 'segment'] as const).map(category => <Chip key={category} selected={mapCategory === category}
          aria-controls="community-map-results" onClick={() => changeMapCategory(category)}
          label={category === 'all' ? '전체' : category === 'spot' ? '스팟' : category === 'segment' ? '구간' : '산'} />)}
      </div>}
    </CommunityMap>}

    {screen === 'map' && <>
      {inlineMountainDetail ? <BottomSheet title={mountain.name} showClose={false}
        className={`community-page__sheet community-page__sheet--detail community-page__sheet--detail-mountain community-page__sheet--detail-level-${sheetLevel}${sheetPeek ? ' community-page__sheet--peek' : ''}`}
        headerAction={mountainHeaderScore}
        handleProps={handleProps} bodyHidden={sheetPeek}
        content={<div id="community-map-results">{mountainReviewContent}</div>}
        showFooter={!readOnly} footer={<Button fullWidth label="후기 등록" onClick={() => registerReview(() => beginReview('mountain', mountainId))} />} />
        : <BottomSheet title={mapCategory === 'spot' ? '스팟 사진·후기' : mapCategory === 'segment' ? '구간 후기' : mapCategory === 'all' ? '전체 후기' : '지도에서 후기 보기'} headerAction={<ReviewEligibilityInfo />} showClose={false} className={`community-page__sheet community-page__sheet--map${mapCategory === 'spot' ? ' community-page__sheet--map-spot' : ''}${sheetPeek ? ' community-page__sheet--peek' : ''}`}
        handleProps={handleProps} bodyHidden={sheetPeek}
        content={<div id="community-map-results" className="community-map-results" aria-live="polite">
          {(mapCategory === 'all' || mapCategory === 'mountain') && <section className="community-map-section" aria-label="산 평점과 후기">
            <h3>산 평점·후기</h3>
            <button type="button" className="community-preview-row" onClick={() => showDetail('mountain', mountain.id)}>
              {mountainPhotoTotal > 0 ? <img className="community-preview-row__photo" src={mountainPhotos[0] ?? mountainExample} alt="" loading="lazy" />
                : <span className="community-preview-row__photo-placeholder" aria-hidden="true"><Icon name="Photo" size={24} /></span>}
              <span className="community-preview-row__text"><strong>{mountain.name}</strong>
                <small>{mountainRating === null ? '후기 0' : `★ ${mountainRating.toFixed(1)} · 후기 ${mountainReviewTotal}`}</small></span>
              <Icon name="ChevronRight" size={18} />
            </button>
          </section>}
          {(mapCategory === 'all' || mapCategory === 'spot') && <section className="community-map-section" aria-label="스팟 사진과 후기">
            {mapCategory === 'spot' ? <div className="community-spot-filter">
              <SpotTypeDropdown value={spotTypeFilter} onChange={changeSpotTypeFilter} /></div>
              : <h3>스팟 사진·후기</h3>}
          {filteredSpots.length === 0 && <EmptyReviewPreview mountainName={mountain.name} kind="spot"
            message={visibleSpots.length === 0 ? undefined : '선택한 종류의 스팟이 없어요'} />}
          {filteredSpots.map(spot => <div key={spot.id} className="community-spot-preview"><button type="button" className="community-preview-row" onClick={() => showDetail('spot', spot.id)}>
            {spot.photos[0] ?? currentReviews('spot', spot.id).flatMap(review => review.photos)[0] ?? (spot.baselinePhotos ? spotExample : undefined)
              ? <img className="community-preview-row__photo" src={spot.photos[0] ?? currentReviews('spot', spot.id).flatMap(review => review.photos)[0] ?? spotExample} alt="" loading="lazy" />
              : <span className="community-preview-row__photo-placeholder" aria-hidden="true"><Icon name="Photo" size={24} /></span>}
            <span className="community-preview-row__text"><strong>{spot.name}</strong>
              <small>사진 {spot.baselinePhotos + spot.photos.length + currentReviews('spot', spot.id).flatMap(review => review.photos).length}장 · 후기 {spot.baselineReviews + currentReviews('spot', spot.id).length}</small></span><Icon name="ChevronRight" size={18} /></button>
          </div>)}
          </section>}
          {(mapCategory === 'all' || mapCategory === 'segment') && <section className="community-map-section" aria-label="구간 후기">
          {mapCategory === 'all' && <h3>구간 후기</h3>}
          {mountainId === 'bukhansan' ? communitySegments.map((segment, index) => {
            const segmentReviewCount = currentReviews('segment', segment.id)
            const status = resolveSegmentStatus(segmentReviewCount, segment.baselineStatus)
            const photo = segmentReviewCount.flatMap(review => review.photos)[0] ?? segmentIllustrations[index % segmentIllustrations.length]
            return <button key={segment.id} type="button" className="community-preview-row" onClick={() => showDetail('segment', segment.id)}>
              <img className="community-preview-row__photo" src={photo} alt="" loading="lazy" />
              <span className="community-preview-row__text"><span className="community-preview-row__heading"><strong>{segment.name}</strong>
                <span className={`community-status-pill community-status-pill--${status}`}>{status === 'good' ? '양호' : status === 'caution' ? '주의 필요' : '위험'}</span></span>
                <small>{segment.distanceKm} km · 후기 {segment.baselineReviews + segmentReviewCount.length}</small></span><Icon name="ChevronRight" size={18} /></button>
          })
            : <EmptyReviewPreview mountainName={mountain.name} kind="segment" />}
          </section>}
        </div>}
        showFooter={!readOnly} footer={<Button fullWidth label="후기 등록" onClick={() => registerReview(() => {
          if (mapCategory === 'all') setReviewKindPickerOpen(true)
          else startMapReview(mapCategory)
        })} />} />}
      {reviewKindPickerOpen && <div className="community-review-kind-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setReviewKindPickerOpen(false) }}>
        <section ref={reviewPickerRef} className="community-review-kind-dialog" role="dialog" aria-modal="true" aria-labelledby="community-review-kind-title"
          onKeyDown={event => {
            if (event.key === 'Escape') { setReviewKindPickerOpen(false); event.stopPropagation() }
            if (event.key !== 'Tab') return
            const buttons = reviewPickerRef.current?.querySelectorAll<HTMLButtonElement>('button')
            if (!buttons?.length) return
            if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus() }
            else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus() }
          }}>
          <h2 id="community-review-kind-title">어떤 후기를 남길까요?</h2>
          <p>후기 유형을 선택해 주세요.</p>
          {(['mountain', 'spot', 'segment'] as const).map(kind => <button type="button" key={kind} onClick={() => startMapReview(kind)}>
            {kind === 'mountain' ? '산 평점·후기' : kind === 'spot' ? '스팟 사진·후기' : '구간 후기'} <Icon name="ChevronRight" size={18} />
          </button>)}
          <button type="button" className="community-review-kind-dialog__cancel" onClick={() => setReviewKindPickerOpen(false)}>취소</button>
        </section>
      </div>}
    </>}

    {isDetail && <>
      <BottomSheet showClose={false} className={`community-page__sheet community-page__sheet--detail community-page__sheet--detail-${screen === 'mountainDetail' ? 'mountain' : screen === 'spotDetail' ? 'spot' : 'segment'} community-page__sheet--detail-level-${sheetLevel}${sheetPeek ? ' community-page__sheet--peek' : ''}`}
        handleProps={handleProps} bodyHidden={sheetPeek}
        title={screen === 'mountainDetail' ? mountain.name : screen === 'spotDetail' ? selectedSpot?.name ?? '스팟' : selectedSegment.name}
        headerAction={screen === 'mountainDetail' && mountainRating !== null
          ? mountainHeaderScore
          : screen === 'segmentDetail' ? <span className={`community-status-pill community-status-pill--${segmentStatus}`}>{segmentStatus === 'good' ? '양호' : segmentStatus === 'caution' ? '주의 필요' : '위험'}</span> : undefined}
        content={screen === 'mountainDetail' ? mountainReviewContent : screen === 'spotDetail' ? selectedSpot && (isSpotHidden(votes[selectedSpot.id]) ?
          <><EmptyState showIcon={false} title="이 스팟은 현재 숨겨져 있어요." description="부정 평가가 기준에 도달해 지도와 목록에 표시되지 않습니다. 내 평가를 취소하거나 변경하면 다시 표시될 수 있어요." />
            {votes[selectedSpot.id]?.viewer && <section className="community-vote"><h3>내 평가 변경</h3><div><button type="button" disabled={readOnly} aria-pressed={votes[selectedSpot.id]?.viewer === 'yes'} onClick={() => castVote('yes')}>맞는 정보예요 <span>{votes[selectedSpot.id]?.yes ?? 0}</span></button><button type="button" disabled={readOnly} aria-pressed={votes[selectedSpot.id]?.viewer === 'no'} onClick={() => castVote('no')}>맞지 않아요 <span>{votes[selectedSpot.id]?.no ?? 0}</span></button></div></section>}</> : <>
            <p className="community-detail-meta">사진 {spotGalleryPhotos.length}장 · 후기 {selectedSpot.baselineReviews + selectedSpotReviews.length}</p>
            <div className="community-detail-photos"><CommunityPhotoStrip kindLabel="스팟" photos={spotGalleryPhotos}
              onViewAll={() => openGallery('spot')} onOpen={id => openGalleryPhoto('spot', id)} /></div>
            <div className="community-review-heading"><strong>방문자 후기</strong>
              {(selectedSpotReviews.length > 0 || selectedSpot.baselineReviews > 0 || selectedSpot.seedQuote) &&
                <button type="button" onClick={() => move('spotReviewList')}>후기 모두 보기 <Icon name="ChevronRight" size={16} /></button>}
            </div>
            <ReviewQuotes reviews={selectedSpotReviews} seedQuotes={communityReviewExamples[selectedSpot.id] ?? (selectedSpot.seedQuote ? [selectedSpot.seedQuote] : [])} limit={5} />
            <section className="community-vote"><h3>이 스팟 정보가 맞나요?</h3><p>다른 사용자가 위치와 종류를 확인하는 데 도움이 돼요.</p>
              <div><button type="button" disabled={readOnly} aria-pressed={votes[selectedSpot.id]?.viewer === 'yes'} onClick={() => castVote('yes')}>맞는 정보예요 <span>{votes[selectedSpot.id]?.yes ?? 0}</span></button>
                <button type="button" disabled={readOnly} aria-pressed={votes[selectedSpot.id]?.viewer === 'no'} onClick={() => castVote('no')}>맞지 않아요 <span>{votes[selectedSpot.id]?.no ?? 0}</span></button></div>
            </section>
          </>) : <>
          <p className="community-detail-meta">{selectedSegment.distanceKm} km · 후기 {selectedSegment.baselineReviews + segmentReviews.length}</p>
          <div className="community-detail-photos"><CommunityPhotoStrip kindLabel="구간" photos={segmentGalleryPhotos}
            onViewAll={() => openGallery('segment')} onOpen={id => openGalleryPhoto('segment', id)} /></div>
          <div className="community-review-heading"><strong>방문자 후기</strong>
            {(segmentReviews.length > 0 || !!communityReviewExamples[selectedSegment.id]?.length) &&
              <button type="button" onClick={() => move('segmentReviewList')}>후기 모두 보기 <Icon name="ChevronRight" size={16} /></button>}
          </div>
          <ReviewQuotes reviews={segmentReviews} seedQuotes={communityReviewExamples[selectedSegment.id]} limit={5} />
          <section className="community-vote"><h3>이 구간 정보가 맞나요?</h3><p>다른 사용자가 구간 상태를 확인하는 데 도움이 돼요.</p>
            <div><button type="button" disabled={readOnly} aria-pressed={segmentVote.viewer === 'yes'} onClick={() => castSegmentVote('yes')}>맞는 정보예요 <span>{segmentVote.yes}</span></button>
              <button type="button" disabled={readOnly} aria-pressed={segmentVote.viewer === 'no'} onClick={() => castSegmentVote('no')}>맞지 않아요 <span>{segmentVote.no}</span></button></div>
          </section>
        </>}
        showFooter={!readOnly && !(screen === 'spotDetail' && selectedSpot && isSpotHidden(votes[selectedSpot.id]))}
        footer={<Button fullWidth label="후기 등록" onClick={() => registerReview(() => {
          if (screen === 'mountainDetail') beginReview('mountain', mountainId)
          else if (screen === 'spotDetail' && selectedSpot) beginReview('spot', selectedSpot.id)
          else beginReview('segment', selectedSegment.id)
        })} />} />
    </>}

    {screen === 'photoAlbum' && <CommunityPhotoAlbum photos={galleryPhotos} title={galleryTitle} onOpen={id => openGalleryPhoto(galleryKind, id)} />}
    {screen === 'spotReviewList' && selectedSpot && <section className="community-gallery-page community-review-list-page" aria-label={`${selectedSpot.name} 전체 후기`}>
      <h2>{selectedSpot.name} 후기</h2>
      <ReviewQuotes reviews={selectedSpotReviews} seedQuotes={communityReviewExamples[selectedSpot.id] ?? (selectedSpot.seedQuote ? [selectedSpot.seedQuote] : [])}
        photos={spotGalleryPhotos} onPhotoOpen={id => setLightboxPhoto(spotGalleryPhotos.find(photo => photo.id === id) ?? null)} />
    </section>}
    {screen === 'mountainReviewList' && <section className="community-gallery-page community-review-list-page" aria-label={`${mountain.name} 전체 후기`}>
      <h2>{mountain.name} 후기</h2>
      <ReviewQuotes reviews={mountainReviews} seedQuotes={hasMountainBaseline ? communityReviewExamples.bukhansan : undefined} showRating
        photos={mountainGalleryPhotos} onPhotoOpen={id => setLightboxPhoto(mountainGalleryPhotos.find(photo => photo.id === id) ?? null)} />
    </section>}
    {screen === 'segmentReviewList' && <section className="community-gallery-page community-review-list-page" aria-label={`${selectedSegment.name} 전체 후기`}>
      <h2>{selectedSegment.name} 후기</h2>
      <ReviewQuotes reviews={segmentReviews} seedQuotes={communityReviewExamples[selectedSegment.id]}
        photos={segmentGalleryPhotos} onPhotoOpen={id => setLightboxPhoto(segmentGalleryPhotos.find(photo => photo.id === id) ?? null)} />
    </section>}
    {screen === 'photoReview' && selectedGalleryPhoto && <CommunityPhotoReview photo={selectedGalleryPhoto} kind={galleryKind} index={selectedGalleryIndex} total={galleryPhotos.length}
      onPrevious={() => setGalleryPhotoId(galleryPhotos[selectedGalleryIndex - 1].id)}
      onNext={() => setGalleryPhotoId(galleryPhotos[selectedGalleryIndex + 1].id)} />}

    {lightboxPhoto?.src && <ModalLayer className="community-photo-lightbox" onDismiss={() => setLightboxPhoto(null)}
      onPointerDown={event => { if (event.target === event.currentTarget) setLightboxPhoto(null) }}>
      <div className="community-photo-lightbox__dialog" role="dialog" aria-modal="true" aria-label="후기 사진 크게 보기">
        <button type="button" className="community-photo-lightbox__close" aria-label="사진 닫기" onClick={() => setLightboxPhoto(null)}><Icon name="Close" size={24} color="currentColor" /></button>
        <img src={lightboxPhoto.src} alt="확대한 후기 사진" />
      </div>
    </ModalLayer>}

    {screen === 'review' && <ReviewForm draft={draft} mountainName={mountain.name} spot={draftSpot} errors={errors}
      canSubmit={reviewEligible} eligibilityMessage={reviewEligibilityMessage}
      onChange={updateDraft} onError={notify} onChooseSpot={() => { setPickerSpotId(draft.targetId || null); move('spotPicker') }}
      onChooseSegment={() => { setSegmentStart(null); setSegmentEnd(null); setSegmentVia(null); setSegmentStage('start'); move('segmentPicker') }}
      onNewSpot={() => move('newSpot')} onSubmit={submitReview} />}

    {screen === 'spotPicker' && <div className="community-form-layout community-picker">
      <div className="community-form-layout__scroll"><h2>스팟 위치 선택</h2><p className="community-form-subtitle">지도에서 등록된 스팟을 고르거나 새 위치를 지정해 주세요.</p>
        <div className="community-picker__map"><CommunityMap markers={pickSpotMarkers} center={mountainId === 'bukhansan' ? communityCourse.routeCoordinates[3] : mountain.position as Coordinate} zoom={14.8}
          showRoute={mountainId === 'bukhansan'}
          onMarkerSelect={setPickerSpotId} ariaLabel="등록된 스팟 선택" /></div>
        <p className="community-picker__selection">{visibleSpots.find(spot => spot.id === pickerSpotId)?.name ? `선택한 스팟 · ${visibleSpots.find(spot => spot.id === pickerSpotId)?.name}` : '스팟을 선택해 주세요.'}</p>
        <button type="button" className="community-inline-link" onClick={() => move('newSpot')}>찾는 스팟이 없나요? 새 스팟 등록</button>
      </div><div className="community-form-layout__action"><Button fullWidth label="이 스팟으로 후기 작성" onClick={() => {
        if (!pickerSpotId || !visibleSpots.some(spot => spot.id === pickerSpotId)) { notify('스팟을 선택해 주세요.'); return }
        updateDraft({ kind: 'spot', targetId: pickerSpotId }); if (screens.includes('review')) back(); else move('review')
      }} /></div>
    </div>}

    {screen === 'segmentPicker' && <div className="community-form-layout community-picker">
      <div className="community-form-layout__scroll"><h2>구간 선택</h2><p className="community-form-subtitle">지도에서 출발과 도착을 차례로 지정해 주세요. 경유지는 선택 사항입니다.</p>
        <div className="community-segment-stages" role="group" aria-label="구간 지점 종류">
          {([['start', '출발'], ['via', '경유 · 선택'], ['end', '도착']] as const).map(([stage, label]) => <button type="button" key={stage}
            aria-pressed={segmentStage === stage} onClick={() => setSegmentStage(stage)}>{label}</button>)}
        </div><div className="community-picker__map"><CommunityMap markers={segmentMarkers} center={communityCourse.routeCoordinates[3]} zoom={14.8}
          onMapSelect={selectSegmentPoint} ariaLabel="코스 위 구간 선택" /></div>
        <p className="community-picker__selection">{segmentStart === null ? '출발 지점을 선택해 주세요.' : segmentEnd === null
          ? `출발 지점 ${segmentStart + 1} · 도착 지점을 선택해 주세요.`
          : `출발 지점 ${segmentStart + 1}${segmentVia !== null ? ` · 경유 지점 ${segmentVia + 1}` : ''} · 도착 지점 ${segmentEnd + 1}`}</p>
        <button type="button" className="community-inline-chip" onClick={() => {
          setSegmentStart(2); setSegmentVia(null); setSegmentEnd(6); setSegmentStage('end')
        }}>백운대 오름 구간 선택</button>
      </div><div className="community-form-layout__action"><Button fullWidth label="이 구간으로 후기 작성" onClick={() => {
        if (screens.includes('review')) confirmSegment()
        else {
          if (segmentStart === null || segmentEnd === null || segmentStart === segmentEnd) { notify('출발과 도착을 다른 지점으로 선택해 주세요.'); return }
          const low = Math.min(segmentStart, segmentEnd), high = Math.max(segmentStart, segmentEnd)
          if (segmentVia !== null && (segmentVia < low || segmentVia > high)) { notify('경유지는 출발과 도착 사이에서 선택해 주세요.'); return }
          const path = routePoints.slice(low, high + 1)
          setDraft({ ...blankDraft('segment', nearestSegment(path).id), segmentCoordinates: segmentStart < segmentEnd ? path : path.reverse(),
            segmentVia: segmentVia === null ? undefined : routePoints[segmentVia] })
          move('review')
        }
      }} /></div>
    </div>}

    {screen === 'newSpot' && <SpotRegistration spots={spots} votes={votes} mountainId={mountainId} mountainCenter={mountain.position as Coordinate} onError={notify}
      onCreate={spot => {
        setSpots(current => [...current, spot]); setDetailSpotId(spot.id)
        if (onSpotRegistered) { onSpotRegistered(); return }
        if (screens.includes('review')) { updateDraft({ kind: 'spot', targetId: spot.id }); setScreens(current => current.slice(0, -1)) }
        else { setDraft(blankDraft('spot', spot.id)); setScreens(['mountainSelect', 'map', 'review']) }
        notify('스팟을 등록했어요. 이어서 후기를 작성해 주세요.')
      }}
      onUseExisting={(spot, photos) => {
        if (photos.length) setSpots(current => current.map(item => item.id === spot.id ? { ...item, photos: [...item.photos, ...photos] } : item))
        setDetailSpotId(spot.id)
        if (onSpotRegistered) { onSpotRegistered(); return }
        if (screens.includes('review')) { updateDraft({ kind: 'spot', targetId: spot.id }); setScreens(current => current.slice(0, -1)) }
        else { setDraft(blankDraft('spot', spot.id)); setScreens(['mountainSelect', 'map', 'review']) }
        notify('기존 스팟을 선택했습니다. 사진을 추가하고 후기를 이어서 작성할 수 있어요.')
      }} />}

    <BottomNavigation active="community" onNavigate={handleBottomNavigation} className="community-page__nav" />
    {toast && <Toast key={toast.id} message={toast.message} className="community-page__toast" />}
  </main>
}
