import { lazy, Suspense, type ComponentType } from 'react'
import type { PlannedHike } from './types/hiking'
import { HomePage } from './pages/HomePage/HomePage'
import { CourseFlow } from './pages/CourseDetailPage/CourseFlow'
import { readCourseRoute } from './routes/courseRoutes'
import { hikePaths, navigateTab as navigateFromBottom } from './pages/hikeRoutes'
import { internalReturnPath } from './routes/communityRoutes'
import { saveSchedule, useHikeSchedules } from './store/hikeScheduleStore'
import { courseFixtures } from './api/courseMock'
import { useCompletedHikes } from './store/hikeSessionStore'
import { navigate, routePath, useHashRoute } from './hooks/useHashRoute'
import { HikeActivePage } from './pages/HikeActivePage/HikeActivePage'
import { HikeCalendarPage } from './pages/HikeCalendarPage/HikeCalendarPage'
import { HikeCompletePage } from './pages/HikeCompletePage/HikeCompletePage'
import { HikeDescentPage } from './pages/HikeDescentPage/HikeDescentPage'
import { HikeDetailPage } from './pages/HikeDetailPage/HikeDetailPage'
import { HikeTodayPage } from './pages/HikeTodayPage/HikeTodayPage'

const CartPage = lazy(() => import('./pages/CartPage/CartPage').then(({ CartPage: Page }) => ({ default: Page })))
const CommunityPage = lazy(() => import('./pages/CommunityPage/CommunityPage').then(({ CommunityPage: Page }) => ({ default: Page })))
const HikingStatusPage = lazy(() => import('./pages/HikePage/HikePage').then(({ HikePage: Page }) => ({ default: Page })))

// 개발 서버에서만 ?preview=hike-status로 FLOW-06 일정 시트와 상태 화면을 확인한다.
const HikeStatusPreviewPage = import.meta.env.DEV
  ? lazy(() => import('./pages/HikeStatusPreviewPage/HikeStatusPreviewPage').then((module) => ({ default: module.HikeStatusPreviewPage })))
  : null

const FacilityPreviewPage = import.meta.env.DEV
  ? lazy(() => import('./pages/FacilityPreviewPage/FacilityPreviewPage').then((module) => ({ default: module.FacilityPreviewPage })))
  : null

// Figma 화면 설계의 주소(#hikes/...)를 그대로 쓴다.
const hikeRoutes: Record<string, ComponentType> = {
  'hikes/calendar': HikeCalendarPage,
  'hikes/detail': HikeDetailPage,
  'hikes/today': HikeTodayPage,
  'hikes/active': HikeActivePage,
  'hikes/downhill': HikeDescentPage,
}

function App() {
  const route = useHashRoute()
  const schedules = useHikeSchedules()
  const plannedHikes: PlannedHike[] = schedules.map(schedule => ({ date: schedule.date, time: schedule.startTime,
    courseId: schedule.courseId, mountain: schedule.mountainName, courseName: schedule.courseName }))
  const completedHikes = useCompletedHikes()

  function planHike(plannedHike: PlannedHike) {
    // 등산 담기 시트에서 같은 날짜 대체 확인을 이미 거쳤으므로 대체 등록으로 보낸다.
    saveSchedule({ date: plannedHike.date, startTime: plannedHike.time, courseId: plannedHike.courseId,
      mountainName: plannedHike.mountain, courseName: plannedHike.courseName,
      distanceKm: courseFixtures.find(course => course.id === plannedHike.courseId)?.distanceKm ?? 0 },
    { replaceExisting: true })
      .then(saved => navigate(hikePaths.calendar(saved.date)))
      .catch(() => navigate(hikePaths.calendar(plannedHike.date)))
  }

  if (HikeStatusPreviewPage && new URLSearchParams(window.location.search).get('preview') === 'hike-status') {
    return <Suspense fallback={null}><HikeStatusPreviewPage /></Suspense>
  }

  if (FacilityPreviewPage && new URLSearchParams(window.location.search).get('preview') === 'facilities') {
    return <Suspense fallback={<main className="app-route-loading" aria-busy="true">시설 검토 화면을 불러오는 중이에요</main>}><FacilityPreviewPage /></Suspense>
  }

  if (routePath(route) === 'community') {
    const query = new URLSearchParams(route.split('?')[1] ?? '')
    const fromHikeComplete = query.get('from') === 'hikes/complete'
    const returnTo = internalReturnPath(query.get('returnTo'), fromHikeComplete ? 'hikes/complete' : '')
    const entry = query.get('screen')
    const initialScreen = entry === 'spotDetail' || entry === 'courseReviewList' || entry === 'map' || entry === 'spotPicker' || entry === 'newSpot' ? entry : fromHikeComplete ? 'review' : 'mountainSelect'
    return <Suspense fallback={<main className="app-route-loading" aria-busy="true">커뮤니티 화면을 불러오는 중이에요</main>}>
      <CommunityPage key={route} initialScreen={initialScreen} initialMountainId={query.get('mountain') ?? completedHikes[0]?.mountainId}
        initialSpotId={query.get('spot') ?? undefined}
        initialCourseId={query.get('course') ?? undefined}
        spotRegistrationMode={query.get('mode') === 'active' ? 'active' : 'postHike'}
        onSpotRegistered={(entry === 'newSpot' || (entry === 'spotPicker' && query.get('mode') === 'active')) && returnTo.startsWith('hikes/') ? () => { window.location.hash = returnTo } : undefined}
        onExit={() => { window.location.hash = returnTo }} onNavigateOutside={navigateFromBottom} />
    </Suspense>
  }

  if (routePath(route) === 'cart' || routePath(route).startsWith('cart/')) {
    return <Suspense fallback={<main className="app-route-loading" aria-busy="true">화면을 불러오는 중이에요</main>}>
      <CartPage
        route={`#${route}`}
        plannedHikes={plannedHikes}
        onPlanHike={planHike}
        onNavigateOutsideCart={navigateFromBottom}
      />
    </Suspense>
  }

  if (routePath(route) === 'myHikes') return <HikeCalendarPage />
  if (routePath(route).startsWith('hike/')) {
    return <Suspense fallback={<main className="app-route-loading" aria-busy="true">등산 화면을 불러오는 중이에요</main>}>
      <HikingStatusPage
        key={route}
        route={`#${route}`}
        plannedHikes={plannedHikes}
        onNavigate={navigateFromBottom}
        onBack={() => { window.location.hash = 'hikes/calendar' }}
        onFinish={() => { window.location.hash = 'hikes/calendar' }}
      />
    </Suspense>
  }
  if (routePath(route) === 'hikes/complete') return <HikeCompletePage onWriteReview={() => {
    window.location.hash = 'community?from=hikes/complete'
  }} />
  const HikeRoutePage = hikeRoutes[routePath(route)]
  // 주소의 ?값이 바뀌어도 화면을 새로 그리도록 전체 주소를 key로 쓴다.
  if (HikeRoutePage) return <HikeRoutePage key={route} />
  const courseRoute = readCourseRoute(route)
  if (courseRoute) return <CourseFlow route={route} />
  const preview = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null
  const schedule = preview?.get('preview') === 'home' ? preview.get('schedule') : null
  return <HomePage previewSchedule={schedule === 'none' || schedule === 'active' ? schedule : undefined} />
}

export default App
