import { useEffect, useState } from 'react'
import { HomePage } from './pages/HomePage/HomePage'
import { CourseListPage } from './pages/CourseListPage/CourseListPage'
import { readCourseRoute } from './routes/courseRoutes'

function App() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const update = () => setHash(window.location.hash)
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const courseRoute = readCourseRoute(hash)
  const preview = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null
  const schedule = preview?.get('preview') === 'home' ? preview.get('schedule') : null
  // 상세·일정 경로는 현재 목록을 유지하며, 후속 화면 통합 시 이곳에서 분기한다.
  if (courseRoute) return <CourseListPage key={courseRoute.mountainId} mountainId={courseRoute.mountainId} initialCourseId={courseRoute.courseId} />
  return <HomePage previewSchedule={schedule === 'none' || schedule === 'active' ? schedule : undefined} />
}

export default App
