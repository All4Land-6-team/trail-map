import { lazy, Suspense, useState, type ComponentType } from 'react'
import type { BottomDestination } from './components/layout'
import type { PlannedHike } from './types/hiking'
import { HomePage } from './pages/HomePage/HomePage'
import { CourseListPage } from './pages/CourseListPage/CourseListPage'
import { readCourseRoute } from './routes/courseRoutes'
import { CourseDetailPage } from './pages/CourseDetailPage/CourseDetailPage'
import { readCourseDetailView } from './routes/courseDetailRoutes'
import { routePath, useHashRoute } from './hooks/useHashRoute'
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

// Figma 화면 설계의 주소(#hikes/...)를 그대로 쓴다.
const hikeRoutes: Record<string, ComponentType> = {
  'hikes/calendar': HikeCalendarPage,
  'hikes/detail': HikeDetailPage,
  'hikes/today': HikeTodayPage,
  'hikes/active': HikeActivePage,
  'hikes/downhill': HikeDescentPage,
  'hikes/complete': HikeCompletePage,
}

function App() {
  const route = useHashRoute()
  const [plannedHikes, setPlannedHikes] = useState<PlannedHike[]>([])

  function navigateFromBottom(destination: BottomDestination) {
    window.location.hash = destination === 'home' ? '' : destination === 'saved' ? 'cart' : destination
  }

  function planHike(plannedHike: PlannedHike) {
    setPlannedHikes((current) => [
      ...current.filter((schedule) => schedule.date !== plannedHike.date),
      plannedHike,
    ])
  }

  if (HikeStatusPreviewPage && new URLSearchParams(window.location.search).get('preview') === 'hike-status') {
    return <Suspense fallback={null}><HikeStatusPreviewPage /></Suspense>
  }

  if (routePath(route) === 'community') {
    return <Suspense fallback={<main className="app-route-loading" aria-busy="true">커뮤니티 화면을 불러오는 중이에요</main>}>
      <CommunityPage onExit={() => { window.location.hash = '' }} onNavigateOutside={navigateFromBottom} />
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

  if (routePath(route) === 'myHikes' || routePath(route).startsWith('hike/')) {
    return <Suspense fallback={<main className="app-route-loading" aria-busy="true">등산 화면을 불러오는 중이에요</main>}>
      <HikingStatusPage
        key={route}
        route={`#${route}`}
        plannedHikes={plannedHikes}
        onNavigate={navigateFromBottom}
        onBack={() => { window.location.hash = 'myHikes' }}
        onFinish={() => { window.location.hash = 'myHikes?completed=1' }}
      />
    </Suspense>
  }
  const HikeRoutePage = hikeRoutes[routePath(route)]
  // 주소의 ?값이 바뀌어도 화면을 새로 그리도록 전체 주소를 key로 쓴다.
  if (HikeRoutePage) return <HikeRoutePage key={route} />
  const courseRoute = readCourseRoute(route)
  if (courseRoute?.courseId) return <CourseDetailPage key={`${courseRoute.mountainId}/${courseRoute.courseId}`}
    mountainId={courseRoute.mountainId} courseId={courseRoute.courseId} view={readCourseDetailView(route)}
    scheduleRequested={courseRoute.destination === 'schedule'} />
  if (courseRoute) return <CourseListPage key={courseRoute.mountainId} mountainId={courseRoute.mountainId} initialCourseId={courseRoute.selectedCourseId} />
  const preview = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null
  const schedule = preview?.get('preview') === 'home' ? preview.get('schedule') : null
  return <HomePage previewSchedule={schedule === 'none' || schedule === 'active' ? schedule : undefined} />
}

export default App
