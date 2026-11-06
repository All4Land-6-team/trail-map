import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'

type SheetLevel = 'peek' | 'content'
export type DetailSheetLevel = 'collapsed' | 'peek' | 'photo' | 'reviews' | 'expanded'
type DetailStop = { item: DetailSheetLevel; height: number }
type DetailHeights = Record<DetailSheetLevel, number>
type SheetDrag = { id: number; y: number; height: number; content: number; moved: boolean; stops?: DetailStop[] }
const PEEK_HEIGHT = 32
const DETAIL_COLLAPSED_HEIGHT = PEEK_HEIGHT
const DETAIL_PEEK_HEIGHT = 116
const DETAIL_PEEK_TRIM = 4
const MIN_VISIBLE_MAP = 170
const DETAIL_MAP_CLEARANCE = 96
const REVIEW_HEIGHT = 485
const COMPACT_REVIEW_HEIGHT = 464
const PHOTO_HEIGHT = 310
const PHOTO_STAGE_GAP = 8
const REVIEW_TO_FULL_GAP = 55
const SNAP_MAGNET_DISTANCE = 22
const DETAIL_LEVELS: DetailSheetLevel[] = ['collapsed', 'peek', 'photo', 'reviews', 'expanded']
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const wholePixel = (value: number) => Math.round(value)
const sameHeights = (a: DetailHeights, b: DetailHeights) => DETAIL_LEVELS.every(level => a[level] === b[level])

/** 후기 지도는 고정하고 공통 BottomSheet만 손잡이로 이동한다. */
export function useCommunitySheet(detail = false, mapPreview = false, compactDetail = false, expandableDetail = false, detailCanReachTop = false, detailKey = '') {
  const rootRef = useRef<HTMLElement>(null)
  const naturalHeight = useRef(240)
  const drag = useRef<SheetDrag | null>(null)
  const settleTimer = useRef<number | null>(null)
  const animationFrame = useRef<number | null>(null)
  const dragFrame = useRef<number | null>(null)
  const pendingDragHeight = useRef<number | null>(null)
  // Touch browsers can synthesize a click after pointerup, after a zero-delay timer has run.
  const suppressClickUntil = useRef(0)
  const [level, setLevel] = useState<SheetLevel>('content')
  const [detailLevel, setDetailLevel] = useState<DetailSheetLevel>('reviews')
  const [measuredDetailKey, setMeasuredDetailKey] = useState(detailKey)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const [mapHeight, setMapHeight] = useState<number | null>(null)
  const [detailHeights, setDetailHeights] = useState<DetailHeights>(() => ({
    collapsed: DETAIL_COLLAPSED_HEIGHT, peek: DETAIL_PEEK_HEIGHT, photo: PHOTO_HEIGHT,
    reviews: compactDetail ? COMPACT_REVIEW_HEIGHT : REVIEW_HEIGHT,
    expanded: compactDetail ? COMPACT_REVIEW_HEIGHT : REVIEW_HEIGHT,
  }))
  const detailHeightsRef = useRef(detailHeights)
  const [dragging, setDragging] = useState(false)
  useEffect(() => () => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current)
    if (dragFrame.current !== null) window.cancelAnimationFrame(dragFrame.current)
  }, [])
  useLayoutEffect(() => {
    if (!detail || !detailKey) return
    stopAnimation()
    setDragging(false)
    setDragHeight(null)
    const fallback = compactDetail ? COMPACT_REVIEW_HEIGHT : REVIEW_HEIGHT
    const initial = { collapsed: DETAIL_COLLAPSED_HEIGHT, peek: DETAIL_PEEK_HEIGHT, photo: PHOTO_HEIGHT,
      reviews: fallback, expanded: fallback }
    detailHeightsRef.current = initial
    setDetailHeights(initial)
    setDetailLevel('reviews')
    setMeasuredDetailKey('')
  }, [detail, detailKey, compactDetail])
  useLayoutEffect(() => {
    if (!detail) return
    const sheet = currentSheet()
    if (!sheet) return
    const content = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet .af-bottom-sheet__content')
    if (detailLevel === 'photo' && content) content.scrollTop = 0

    const measure = () => {
      if (drag.current) return
      const next = measureDetailHeights()
      detailHeightsRef.current = next
      setDetailHeights(current => sameHeights(current, next) ? current : next)
      setMeasuredDetailKey(detailKey)
    }
    measure()
    const observer = new ResizeObserver(measure)
    const observed = [rootRef.current, sheet, content,
      sheet.querySelector<HTMLElement>('.community-detail-photos'),
      sheet.querySelector<HTMLElement>('.community-review-carousel'),
      sheet.querySelector<HTMLElement>('.af-bottom-sheet__footer')]
    observed.forEach(element => { if (element) observer.observe(element) })
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [detail, detailKey, detailLevel, compactDetail, expandableDetail, detailCanReachTop])

  function currentSheet() { return rootRef.current?.querySelector<HTMLElement>('.community-page__sheet') }
  function measuredPhotoHeight(maximum: number) {
    const sheet = currentSheet()
    const photos = sheet?.querySelector<HTMLElement>('.community-detail-photos')
    const content = sheet?.querySelector<HTMLElement>('.af-bottom-sheet__content')
    const footer = sheet?.querySelector<HTMLElement>('.af-bottom-sheet__footer')
    if (!sheet || !photos || !content || !footer) return clamp(PHOTO_HEIGHT, PEEK_HEIGHT, maximum)
    const sheetStyle = getComputedStyle(sheet)
    const target = photos.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top + content.scrollTop + PHOTO_STAGE_GAP
      + footer.getBoundingClientRect().height + (Number.parseFloat(sheetStyle.paddingBottom) || 0)
    return clamp(target, PEEK_HEIGHT, maximum)
  }
  function maximumHeight() {
    const navHeight = rootRef.current?.querySelector<HTMLElement>('.community-page__nav')?.getBoundingClientRect().height ?? 70
    return Math.max(PEEK_HEIGHT, (rootRef.current?.getBoundingClientRect().height ?? 844) - navHeight - (detail ? detailCanReachTop ? 0 : DETAIL_MAP_CLEARANCE : MIN_VISIBLE_MAP))
  }
  function expandedHeight(minimum: number, maximum: number) {
    const sheet = currentSheet()
    const content = sheet?.querySelector<HTMLElement>('.af-bottom-sheet__content')
    const body = sheet?.querySelector<HTMLElement>('.af-bottom-sheet__body')
    const footer = body?.querySelector<HTMLElement>('.af-bottom-sheet__footer')
    if (!expandableDetail || !sheet || !content || !body || !footer) return minimum
    const bodyGap = Number.parseFloat(getComputedStyle(body).rowGap || getComputedStyle(body).gap) || 0
    const sheetStyle = getComputedStyle(sheet)
    const target = content.getBoundingClientRect().top - sheet.getBoundingClientRect().top + content.scrollHeight
      + footer.getBoundingClientRect().height + bodyGap + (Number.parseFloat(sheetStyle.paddingBottom) || 0)
    return clamp(target, minimum, maximum)
  }
  function measuredReviewHeight(minimum: number, maximum: number) {
    const fallback = Math.min(compactDetail ? COMPACT_REVIEW_HEIGHT : REVIEW_HEIGHT, maximum - REVIEW_TO_FULL_GAP)
    const sheet = currentSheet()
    const body = sheet?.querySelector<HTMLElement>('.af-bottom-sheet__body')
    const content = body?.querySelector<HTMLElement>('.af-bottom-sheet__content')
    const carousel = sheet?.querySelector<HTMLElement>('.community-review-carousel')
    const footer = body?.querySelector<HTMLElement>('.af-bottom-sheet__footer')
    if (!sheet || !body || !content || !carousel || !footer) return clamp(fallback, minimum, maximum)
    const bodyGap = Number.parseFloat(getComputedStyle(body).rowGap || getComputedStyle(body).gap) || 0
    const sheetStyle = getComputedStyle(sheet)
    const carouselBottom = carousel.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top + content.scrollTop
    const target = carouselBottom + footer.getBoundingClientRect().height + bodyGap
      + (Number.parseFloat(sheetStyle.paddingTop) || 0) + (Number.parseFloat(sheetStyle.paddingBottom) || 0)
    return clamp(target, minimum, maximum)
  }
  function measuredNameHeight(maximum: number) {
    const sheet = currentSheet()
    const body = sheet?.querySelector<HTMLElement>('.af-bottom-sheet__body')
    const title = body?.querySelector<HTMLElement>('.af-bottom-sheet__title-row')
    const footer = body?.querySelector<HTMLElement>('.af-bottom-sheet__footer')
    if (!sheet || !body || !title || !footer) return DETAIL_PEEK_HEIGHT
    const sheetStyle = getComputedStyle(sheet)
    const target = title.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top
      + footer.getBoundingClientRect().height + (Number.parseFloat(sheetStyle.paddingBottom) || 0) - DETAIL_PEEK_TRIM
    return clamp(target, PEEK_HEIGHT, maximum)
  }
  function measureDetailHeights(): DetailHeights {
    const maximum = maximumHeight()
    const peek = wholePixel(measuredNameHeight(maximum))
    const photo = wholePixel(Math.max(peek, measuredPhotoHeight(maximum)))
    const reviews = wholePixel(Math.max(photo, measuredReviewHeight(photo, maximum)))
    return {
      collapsed: clamp(DETAIL_COLLAPSED_HEIGHT, 0, maximum), peek, photo, reviews,
      expanded: wholePixel(expandedHeight(reviews, maximum)),
    }
  }
  function heightForDetail(next: DetailSheetLevel) {
    return detailHeightsRef.current[next]
  }
  function detailStops() {
    return DETAIL_LEVELS.map(item => ({ item, height: heightForDetail(item) }))
  }
  function magnetizedHeight(rawHeight: number, stops?: DetailStop[]) {
    if (!detail || !stops?.length) return rawHeight
    const closest = stops.reduce((previous, candidate) => Math.abs(candidate.height - rawHeight) < Math.abs(previous.height - rawHeight) ? candidate : previous)
    return Math.abs(closest.height - rawHeight) <= SNAP_MAGNET_DISTANCE ? closest.height : rawHeight
  }
  const currentLevel = detail ? detailLevel : level
  function contentHeight() {
    if (mapPreview) return mapHeight ?? maximumHeight()
    if (!detail && level === 'content' && dragHeight === null) naturalHeight.current = currentSheet()?.getBoundingClientRect().height ?? naturalHeight.current
    return clamp(naturalHeight.current, PEEK_HEIGHT, maximumHeight())
  }
  function stopAnimation() {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current)
    stopDragFrame()
  }
  function stopDragFrame() {
    if (dragFrame.current !== null) window.cancelAnimationFrame(dragFrame.current)
    dragFrame.current = null
    pendingDragHeight.current = null
  }
  function renderDragHeight(height: number) {
    pendingDragHeight.current = height
    if (dragFrame.current !== null) return
    dragFrame.current = window.requestAnimationFrame(() => {
      if (pendingDragHeight.current !== null) currentSheet()?.style.setProperty('--community-sheet-height', `${pendingDragHeight.current}px`)
      dragFrame.current = null
    })
  }
  function settle(next: SheetLevel | DetailSheetLevel, from: number, to: number) {
    stopAnimation()
    setDragging(false)
    setDragHeight(from)
    if (detail) setDetailLevel(next as DetailSheetLevel)
    else setLevel(next as SheetLevel)
    animationFrame.current = window.requestAnimationFrame(() => {
      animationFrame.current = window.requestAnimationFrame(() => setDragHeight(to))
    })
    settleTimer.current = window.setTimeout(() => setDragHeight(null), 240)
  }
  function changeLevel(next: SheetLevel | DetailSheetLevel) {
    if (next === currentLevel && dragHeight === null) return
    const from = currentSheet()?.getBoundingClientRect().height ?? PEEK_HEIGHT
    const to = detail ? heightForDetail(next as DetailSheetLevel) : next === 'peek' ? PEEK_HEIGHT : contentHeight()
    settle(next, from, to)
  }
  function step(direction: 1 | -1) {
    if (!detail) return direction === 1 ? 'content' : 'peek'
    const index = DETAIL_LEVELS.indexOf(detailLevel)
    return DETAIL_LEVELS[clamp(index + direction, 0, DETAIL_LEVELS.length - 1)]
  }
  function activatedLevel() {
    if (!detail) return peek ? 'content' : 'peek'
    return detailLevel === 'collapsed' ? 'reviews' : step(-1)
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowUp') changeLevel(step(1))
    else if (event.key === 'ArrowDown') changeLevel(step(-1))
    else if (event.key === 'Home') changeLevel(detail ? 'expanded' : 'content')
    else if (event.key === 'End') changeLevel(detail ? 'collapsed' : 'peek')
    else if (event.key === 'Enter' || event.key === ' ') changeLevel(activatedLevel())
    else return
    event.preventDefault()
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    if (current.moved) {
      const height = clamp(current.height + current.y - event.clientY, PEEK_HEIGHT, current.content)
      if (detail) {
        stopDragFrame()
        currentSheet()?.style.setProperty('--community-sheet-height', `${height}px`)
        const distance = current.y - event.clientY
        const stops = current.stops ?? detailStops()
        const closest = stops.reduce((previous, candidate) => Math.abs(candidate.height - height) < Math.abs(previous.height - height) ? candidate : previous)
        const next = Math.abs(distance) < 20 ? stops.find(stop => stop.item === detailLevel) ?? closest : closest
        settle(next.item, height, next.height)
      } else {
        stopDragFrame()
        currentSheet()?.style.setProperty('--community-sheet-height', `${height}px`)
        if (mapPreview && height > PEEK_HEIGHT + SNAP_MAGNET_DISTANCE) {
          setMapHeight(height)
          settle('content', height, height)
        } else {
          const next = height < (PEEK_HEIGHT + current.content) / 2 ? 'peek' : 'content'
          if (mapPreview) setMapHeight(null)
          settle(next, height, next === 'peek' ? PEEK_HEIGHT : current.content)
        }
      }
      suppressClickUntil.current = window.performance.now() + 500
    } else {
      setDragHeight(null)
      setDragging(false)
    }
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const peek = !detail && currentLevel === 'peek' && dragHeight === null
  const collapsed = detail && currentLevel === 'collapsed' && dragHeight === null
  const detailReady = measuredDetailKey === detailKey
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return
    const content = detail || mapPreview ? maximumHeight() : contentHeight()
    stopDragFrame()
    drag.current = { id: event.pointerId, y: event.clientY,
      height: currentSheet()?.getBoundingClientRect().height ?? PEEK_HEIGHT,
      content, moved: false, stops: detail ? detailStops() : undefined }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    event.preventDefault()
    if (Math.abs(event.clientY - current.y) > 5) current.moved = true
    if (current.moved) {
      const rawHeight = clamp(current.height + current.y - event.clientY, PEEK_HEIGHT, current.content)
      const nextHeight = magnetizedHeight(rawHeight, current.stops)
      renderDragHeight(nextHeight)
    }
  }
  const onPointerCancel = () => {
    const current = drag.current
    if (!current) return
    stopDragFrame()
    currentSheet()?.style.setProperty('--community-sheet-height', `${current.height}px`)
    drag.current = null
    setDragging(false)
    setDragHeight(null)
  }
  return {
    rootRef,
    style: { '--community-sheet-transition': dragging || dragHeight === null || !detailReady ? 'none' : 'height 240ms cubic-bezier(0.22, 1, 0.36, 1)', '--community-sheet-height': dragHeight === null
      ? detail ? `${detailReady ? detailHeights[detailLevel] : detailHeightsRef.current.reviews}px`
        : level === 'content' ? mapPreview && mapHeight !== null ? `${mapHeight}px` : mapPreview ? 'min(420px, calc(var(--app-viewport-height) - var(--community-nav-height) - 170px))' : 'auto' : `${PEEK_HEIGHT}px`
      : `${dragHeight}px` } as CSSProperties,
    peek,
    collapsed,
    level: currentLevel,
    reset: () => { stopAnimation(); setDragging(false); setLevel('content'); setDetailLevel('reviews'); setDragHeight(null); setMapHeight(null) },
    handleProps: {
      role: 'button', tabIndex: 0, 'aria-label': detail ? `바텀시트 ${detailLevel === 'collapsed' ? '아래 내림' : detailLevel === 'peek' ? '이름 보기' : detailLevel === 'reviews' ? '기본 보기' : detailLevel === 'photo' ? '사진 보기' : '확장 보기'}. 탭하거나 위아래 방향키로 단계 변경` : peek ? '바텀시트 열기' : '바텀시트 내리기', 'aria-expanded': !peek && !collapsed,
      onKeyDown,
      onClick: (event: MouseEvent<HTMLDivElement>) => {
        if (event.detail !== 0 && window.performance.now() < suppressClickUntil.current) return
        changeLevel(activatedLevel())
      },
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel,
    },
  }
}
