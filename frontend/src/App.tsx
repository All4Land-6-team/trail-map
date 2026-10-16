import { useEffect, useState } from 'react'
import { HomePage } from './pages/HomePage/HomePage'
import { CourseListPage } from './pages/CourseListPage/CourseListPage'
import { readCourseRoute } from './routes/courseRoutes'
import { CourseDetailPage } from './pages/CourseDetailPage/CourseDetailPage'
import { readCourseDetailView } from './routes/courseDetailRoutes'

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
  if (courseRoute?.courseId) return <CourseDetailPage key={`${courseRoute.mountainId}/${courseRoute.courseId}`}
    mountainId={courseRoute.mountainId} courseId={courseRoute.courseId} view={readCourseDetailView(hash)}
    scheduleRequested={courseRoute.destination === 'schedule'} />
  if (courseRoute) return <CourseListPage key={courseRoute.mountainId} mountainId={courseRoute.mountainId} initialCourseId={courseRoute.selectedCourseId} />
  return <HomePage previewSchedule={schedule === 'none' || schedule === 'active' ? schedule : undefined} />
}

export default App
