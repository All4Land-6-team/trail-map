import { createRoot } from 'react-dom/client'
import '../../assets/css/global.css'
import { CommunityPage } from './CommunityPage'

const finishedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
const earlierFinishedAt = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
createRoot(document.getElementById('root')!).render(<CommunityPage completedHikes={[
  { id: 'preview-baegundae', mountainId: 'bukhansan', courseId: 'bukhansan-baegundae', courseName: '백운대 코스', distanceKm: 4.2, finishedAt },
  { id: 'preview-bibong', mountainId: 'bukhansan', courseId: 'bibong', courseName: '비봉 코스', distanceKm: 3.8, finishedAt: earlierFinishedAt },
]} />)
