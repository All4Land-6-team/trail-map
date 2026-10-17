import { lazy, Suspense, type ComponentType } from 'react'
import { HomePage } from './pages/HomePage/HomePage'
import { CourseListPage } from './pages/CourseListPage/CourseListPage'
import { readCourseRoute } from './routes/courseRoutes'
import { routePath, useHashRoute } from './hooks/useHashRoute'
import { HikeActivePage } from './pages/HikeActivePage/HikeActivePage'
import { HikeCalendarPage } from './pages/HikeCalendarPage/HikeCalendarPage'
import { HikeCompletePage } from './pages/HikeCompletePage/HikeCompletePage'
import { HikeDescentPage } from './pages/HikeDescentPage/HikeDescentPage'
import { HikeDetailPage } from './pages/HikeDetailPage/HikeDetailPage'
import { HikeTodayPage } from './pages/HikeTodayPage/HikeTodayPage'

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
  const HikePage = hikeRoutes[routePath(route)]
  // 주소의 ?값이 바뀌어도 화면을 새로 그리도록 전체 주소를 key로 쓴다.
  if (HikePage) return <HikePage key={route} />
  const courseRoute = readCourseRoute(route)
  if (courseRoute) return <CourseListPage key={courseRoute.mountainId} mountainId={courseRoute.mountainId} initialCourseId={courseRoute.courseId} />
  const preview = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null
  const schedule = preview?.get('preview') === 'home' ? preview.get('schedule') : null
  return <HomePage previewSchedule={schedule === 'none' || schedule === 'active' ? schedule : undefined} />
}

export default App
