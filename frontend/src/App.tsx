import { lazy, Suspense, useEffect, useState } from 'react'
import BaseMap from './components/map/BaseMap'
import type { BottomDestination } from './components/layout'
import type { PlannedHike } from './types/hiking'

const CartPage = lazy(() => import('./pages/CartPage/CartPage').then(({ CartPage: Page }) => ({ default: Page })))
const HikePage = lazy(() => import('./pages/HikePage/HikePage').then(({ HikePage: Page }) => ({ default: Page })))

function App() {
  const [route, setRoute] = useState(window.location.hash)
  const [plannedHikes, setPlannedHikes] = useState<PlannedHike[]>([])

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function navigateFromBottom(destination: BottomDestination) {
    window.location.hash = destination === 'home' ? '' : destination === 'saved' ? 'cart' : destination
  }

  function planHike(plannedHike: PlannedHike) {
    setPlannedHikes((current) => [
      ...current.filter((schedule) => schedule.date !== plannedHike.date),
      plannedHike,
    ])
  }

  if (route === '#cart' || route.startsWith('#cart/')) {
    return <Suspense fallback={<main className="app-route-loading" aria-busy="true">화면을 불러오는 중이에요</main>}>
      <CartPage
        route={route}
        plannedHikes={plannedHikes}
        onPlanHike={planHike}
        onNavigateOutsideCart={navigateFromBottom}
      />
    </Suspense>
  }

  if (route.startsWith('#myHikes') || route.startsWith('#hike/')) {
    return <Suspense fallback={<main className="app-route-loading" aria-busy="true">등산 화면을 불러오는 중이에요</main>}>
      <HikePage
        key={route}
        route={route}
        plannedHikes={plannedHikes}
        onNavigate={navigateFromBottom}
        onBack={() => { window.location.hash = 'myHikes' }}
        onFinish={() => { window.location.hash = 'myHikes?completed=1' }}
      />
    </Suspense>
  }

  return <BaseMap />
}

export default App
