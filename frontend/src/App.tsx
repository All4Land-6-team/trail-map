import { lazy, Suspense, useEffect, useState } from 'react'
import BaseMap from './components/map/BaseMap'
import type { BottomDestination } from './components/layout'

const CartPage = lazy(() => import('./pages/CartPage/CartPage').then(({ CartPage: Page }) => ({ default: Page })))

function App() {
  const [route, setRoute] = useState(window.location.hash)

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (route === '#cart' || route.startsWith('#cart/')) {
    return <Suspense fallback={<main className="app-route-loading" aria-busy="true">화면을 불러오는 중이에요</main>}>
      <CartPage route={route} onNavigateOutsideCart={(destination: BottomDestination) => {
        window.location.hash = destination === 'home' ? '' : destination
      }} />
    </Suspense>
  }

  return <BaseMap />
}

export default App
