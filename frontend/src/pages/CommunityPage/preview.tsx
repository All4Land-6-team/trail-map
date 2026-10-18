import { createRoot } from 'react-dom/client'
import '../../assets/css/global.css'
import { CommunityPage } from './CommunityPage'

const finishedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
createRoot(document.getElementById('root')!).render(<CommunityPage completedHike={{ mountainId: 'bukhansan', finishedAt }} />)
