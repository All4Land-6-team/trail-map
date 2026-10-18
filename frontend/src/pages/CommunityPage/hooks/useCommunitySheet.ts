import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'

type SheetLevel = 'peek' | 'content'
export type DetailSheetLevel = 'peek' | 'reviews' | 'photo' | 'full'
const PEEK_HEIGHT = 32
const MIN_VISIBLE_MAP = 170
const DETAIL_MAP_CLEARANCE = 96
const REVIEW_HEIGHT = 520
const COMPACT_REVIEW_HEIGHT = 464
const PHOTO_HEIGHT = 350
const REVIEW_TO_FULL_GAP = 55
const PHOTO_TO_FULL_GAP = 170
const DETAIL_LEVELS: DetailSheetLevel[] = ['peek', 'photo', 'reviews', 'full']
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** 후기 지도는 고정하고 공통 BottomSheet만 손잡이로 이동한다. */
export function useCommunitySheet(detail = false, mapPreview = false, compactDetail = false) {
  const rootRef = useRef<HTMLElement>(null)
  const naturalHeight = useRef(240)
  const drag = useRef<{ id: number; y: number; height: number; content: number; moved: boolean } | null>(null)
  const settleTimer = useRef<number | null>(null)
  const animationFrame = useRef<number | null>(null)
  // Touch browsers can synthesize a click after pointerup, after a zero-delay timer has run.
  const suppressClickUntil = useRef(0)
  const [level, setLevel] = useState<SheetLevel>('content')
  const [detailLevel, setDetailLevel] = useState<DetailSheetLevel>('reviews')
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  useEffect(() => () => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current)
  }, [])
  useEffect(() => {
    if (!detail || detailLevel === 'peek') return
    const content = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet .af-bottom-sheet__content')
    if (!content) return
    if (detailLevel === 'photo') {
      content.scrollTop = 0
    }
  }, [detail, detailLevel])

  function currentSheet() { return rootRef.current?.querySelector<HTMLElement>('.community-page__sheet') }
  function maximumHeight() {
    const navHeight = rootRef.current?.querySelector<HTMLElement>('.community-page__nav')?.getBoundingClientRect().height ?? 70
    return Math.max(PEEK_HEIGHT, (rootRef.current?.getBoundingClientRect().height ?? 844) - navHeight - (detail ? DETAIL_MAP_CLEARANCE : MIN_VISIBLE_MAP))
  }
  function heightForDetail(next: DetailSheetLevel) {
    const maximum = maximumHeight()
    return next === 'peek' ? PEEK_HEIGHT : next === 'reviews' ? clamp(Math.min(compactDetail ? COMPACT_REVIEW_HEIGHT : REVIEW_HEIGHT, maximum - REVIEW_TO_FULL_GAP), PEEK_HEIGHT, maximum)
      : next === 'photo' ? clamp(Math.min(PHOTO_HEIGHT, maximum - PHOTO_TO_FULL_GAP), PEEK_HEIGHT, maximum) : maximum
  }
  const currentLevel = detail ? detailLevel : level
  function contentHeight() {
    if (mapPreview) return Math.min(420, maximumHeight())
    if (!detail && level === 'content' && dragHeight === null) naturalHeight.current = currentSheet()?.getBoundingClientRect().height ?? naturalHeight.current
    return clamp(naturalHeight.current, PEEK_HEIGHT, maximumHeight())
  }
  function stopAnimation() {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current)
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
    if (detailLevel === 'peek' && direction === 1) return 'reviews'
    const index = DETAIL_LEVELS.indexOf(detailLevel)
    return DETAIL_LEVELS[clamp(index + direction, 0, DETAIL_LEVELS.length - 1)]
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowUp') changeLevel(step(1))
    else if (event.key === 'ArrowDown') changeLevel(step(-1))
    else if (event.key === 'Home') changeLevel(detail ? 'full' : 'content')
    else if (event.key === 'End') changeLevel('peek')
    else if (event.key === 'Enter' || event.key === ' ') changeLevel(currentLevel === (detail ? 'full' : 'content')
      ? 'peek' : step(1))
    else return
    event.preventDefault()
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    if (current.moved) {
      const height = clamp(current.height + current.y - event.clientY, PEEK_HEIGHT, current.content)
      if (detail) {
        // A single swipe moves through one stop at a time.
        const distance = current.y - event.clientY
        const next: DetailSheetLevel = Math.abs(distance) < 20 ? detailLevel : step(distance > 0 ? 1 : -1) as DetailSheetLevel
        settle(next, height, heightForDetail(next))
      } else {
        const next = height < (PEEK_HEIGHT + current.content) / 2 ? 'peek' : 'content'
        settle(next, height, next === 'peek' ? PEEK_HEIGHT : current.content)
      }
      suppressClickUntil.current = window.performance.now() + 500
    } else {
      setDragHeight(null)
      setDragging(false)
    }
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const peek = currentLevel === 'peek' && dragHeight === null
  return {
    rootRef,
    style: { '--community-sheet-transition': dragging ? 'none' : 'height 220ms ease-out', '--community-sheet-height': dragHeight === null
      ? detail ? detailLevel === 'peek' ? `${PEEK_HEIGHT}px` : detailLevel === 'reviews' ? `min(${compactDetail ? COMPACT_REVIEW_HEIGHT : REVIEW_HEIGHT}px, calc(100dvh - var(--community-nav-height) - ${DETAIL_MAP_CLEARANCE + REVIEW_TO_FULL_GAP}px))` : detailLevel === 'photo' ? `min(${PHOTO_HEIGHT}px, calc(100dvh - var(--community-nav-height) - ${DETAIL_MAP_CLEARANCE + PHOTO_TO_FULL_GAP}px))` : `calc(100dvh - var(--community-nav-height) - ${DETAIL_MAP_CLEARANCE}px)`
        : level === 'content' ? mapPreview ? 'min(420px, calc(100dvh - var(--community-nav-height) - 170px))' : 'auto' : `${PEEK_HEIGHT}px`
      : `${dragHeight}px` } as CSSProperties,
    peek,
    level: currentLevel,
    reset: () => { stopAnimation(); setDragging(false); setLevel('content'); setDetailLevel('reviews'); setDragHeight(null) },
    handleProps: {
      role: 'button', tabIndex: 0, 'aria-label': detail ? `바텀시트 ${detailLevel === 'peek' ? '접힘' : detailLevel === 'reviews' ? '기본 보기' : detailLevel === 'photo' ? '사진 보기' : '전체 보기'}. 탭하거나 위아래 방향키로 단계 변경` : peek ? '바텀시트 열기' : '바텀시트 내리기', 'aria-expanded': !peek,
      onKeyDown,
      onClick: (event: MouseEvent<HTMLDivElement>) => {
        if (event.detail !== 0 && window.performance.now() < suppressClickUntil.current) return
        changeLevel(detail ? detailLevel === 'full' ? 'peek' : step(1) : peek ? 'content' : 'peek')
      },
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
        drag.current = { id: event.pointerId, y: event.clientY,
          height: currentSheet()?.getBoundingClientRect().height ?? PEEK_HEIGHT,
          content: detail ? maximumHeight() : contentHeight(), moved: false }
        setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current
        if (!current || current.id !== event.pointerId) return
        if (Math.abs(event.clientY - current.y) > 5) current.moved = true
        if (current.moved) setDragHeight(clamp(current.height + current.y - event.clientY, PEEK_HEIGHT, current.content))
      },
      onPointerUp: finish,
      onPointerCancel: () => { drag.current = null; setDragging(false); setDragHeight(null) },
      onLostPointerCapture: () => { drag.current = null },
    },
  }
}
