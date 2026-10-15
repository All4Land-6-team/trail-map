const STATIC_GEO_CACHE = 'trail-map-static-geo-v1'
const APP_SHELL_CACHE = 'trail-map-app-shell-__BUILD_ID__'
const APP_SHELL_PATHS = /* __PRECACHE_MANIFEST__ */ []
const appShellUrls = new Set(APP_SHELL_PATHS.map((path) => new URL(path, self.registration.scope).href))
const staticGeoEndpoints = new Set(JSON.parse(
  new URL(self.location.href).searchParams.get('staticGeoEndpoints') || '[]',
))

self.addEventListener('install', (event) => {
  if (APP_SHELL_PATHS.length > 0) {
    event.waitUntil(caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll([...appShellUrls])))
  }
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((name) => name.startsWith('trail-map-app-shell-') && name !== APP_SHELL_CACHE)
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (staticGeoEndpoints.has(`${url.origin}${url.pathname}`)) {
    if (request.headers.has('Authorization')) return
    event.respondWith(loadStaticGeoData(request, event.clientId))
    return
  }

  if (APP_SHELL_PATHS.length === 0) return
  if (request.mode === 'navigate' && url.href.startsWith(self.registration.scope)) {
    event.respondWith(loadAppNavigation(request))
  } else if (appShellUrls.has(url.href)) {
    event.respondWith(loadAppAsset(request))
  }
})

async function loadAppNavigation(request) {
  try {
    return await fetch(request)
  } catch (error) {
    const cache = await caches.open(APP_SHELL_CACHE)
    return await cache.match(new URL('index.html', self.registration.scope).href) ?? Promise.reject(error)
  }
}

async function loadAppAsset(request) {
  const cache = await caches.open(APP_SHELL_CACHE)
  return await cache.match(request) ?? fetch(request)
}

async function loadStaticGeoData(request, clientId) {
  const cache = await caches.open(STATIC_GEO_CACHE)

  try {
    const response = await fetch(request)
    if (response.ok && (response.type === 'basic' || response.type === 'cors')) {
      try {
        await cache.put(request, response.clone())
      } catch (error) {
        console.warn('정적 지도 데이터 캐시에 저장하지 못했습니다.', error)
      }
    }
    return response
  } catch (error) {
    const cachedResponse = await cache.match(request)
    if (cachedResponse) return cachedResponse
    if (clientId) {
      const client = await self.clients.get(clientId)
      client?.postMessage({ type: 'STATIC_GEO_CACHE_MISS' })
    }
    throw error
  }
}
