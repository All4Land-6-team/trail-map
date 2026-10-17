import { lazy, Suspense, type ComponentType } from 'react'
import type { BottomDestination } from './components/layout'
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
  if (HikeStatusPreviewPage && new URLSearchParams(window.location.search).get('preview') === 'hike-status') {
    return <Suspense fallback={null}><HikeStatusPreviewPage /></Suspense>
  }
  if (routePath(route) === 'cart' || routePath(route).startsWith('cart/')) {
    return <Suspense fallback={<main className="app-route-loading" aria-busy="true">화면을 불러오는 중이에요</main>}>
      <CartPage route={`#${route}`} onNavigateOutsideCart={(destination: BottomDestination) => {
        window.location.hash = destination === 'home' ? '' : destination
      }} />
    </Suspense>
  }
  const HikePage = hikeRoutes[routePath(route)]
  // 주소의 ?값이 바뀌어도 화면을 새로 그리도록 전체 주소를 key로 쓴다.
  if (HikePage) return <HikePage key={route} />
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
