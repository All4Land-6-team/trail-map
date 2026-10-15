function getStaticGeoEndpoints(): string[] {
  return (import.meta.env.VITE_OFFLINE_STATIC_GEO_URLS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        const url = new URL(value, window.location.origin)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return []
        return [`${url.origin}${url.pathname}`]
      } catch {
        console.warn(`정적 지도 데이터 주소가 올바르지 않아 캐시 대상에서 제외했습니다: ${value}`)
        return []
      }
    })
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  const scope = import.meta.env.BASE_URL
  const workerUrl = new URL(`${scope}sw.js`, window.location.origin)
  const endpoints = getStaticGeoEndpoints()
  if (endpoints.length > 0) {
    workerUrl.searchParams.set('staticGeoEndpoints', JSON.stringify(endpoints))
  }

  navigator.serviceWorker.register(workerUrl, { scope }).catch((error) => {
    console.warn('오프라인 캐시를 시작하지 못했습니다.', error)
  })
}
