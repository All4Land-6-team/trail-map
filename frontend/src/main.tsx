import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/css/global.css'
import './assets/css/app-frame.css'
import App from './App.tsx'
import { registerServiceWorker } from './offline/registerServiceWorker'
import { startHikeOfflineSync } from './store/hikeOfflineSync'

registerServiceWorker()
// 통신이 끊긴 동안 누른 하산 시작·등산 종료를 연결되면 서버로 보낸다.
startHikeOfflineSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
