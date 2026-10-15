const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const { join } = require('node:path')

function cacheableResponse(body) {
  const response = new Response(body, { status: 200 })
  Object.defineProperty(response, 'type', { value: 'cors' })
  return response
}

function createWorker(fetchImpl, endpoints = [], cachePut = async () => {}) {
  const listeners = new Map()
  const cachedResponses = new Map()
  const messages = []
  const cache = {
    put: async (request, response) => {
      await cachePut()
      cachedResponses.set(request.url, response)
    },
    match: async (request) => cachedResponses.get(request.url),
  }
  const self = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    clients: { get: async () => ({ postMessage: (message) => messages.push(message) }) },
    location: { href: `https://app.example.com/sw.js?staticGeoEndpoints=${encodeURIComponent(JSON.stringify(endpoints))}` },
  }

  runInNewContext(
    readFileSync(join(__dirname, '../public/sw.js'), 'utf8'),
    { self, caches: { open: async () => cache }, fetch: fetchImpl, URL, console: { warn() {} } },
  )

  return {
    messages,
    request: (url) => {
      let responsePromise
      listeners.get('fetch')({
        clientId: 'test-client',
        request: { url, method: 'GET', headers: new Headers() },
        respondWith: (promise) => { responsePromise = promise },
      })
      return responsePromise
    },
  }
}

test('방문한 정적 지리 데이터는 오프라인에서 다시 읽는다', async () => {
  let online = true
  const worker = createWorker(async () => {
    if (!online) throw new Error('offline')
    return cacheableResponse('trails')
  }, ['https://api.example.com/trails'])

  const url = 'https://api.example.com/trails?area=bukhansan'
  assert.equal(await (await worker.request(url)).text(), 'trails')
  online = false
  assert.equal(await (await worker.request(url)).text(), 'trails')
  assert.equal(worker.messages.length, 0)
  await assert.rejects(worker.request('https://api.example.com/trails?area=other'))
  assert.equal(worker.messages[0].type, 'STATIC_GEO_CACHE_MISS')
})

test('명시하지 않은 실시간 정보와 OpenFreeMap 요청은 캐시하지 않는다', () => {
  const worker = createWorker(async () => new Response('unused'), ['https://api.example.com/trails'])

  assert.equal(worker.request('https://api.example.com/trails/live'), undefined)
  assert.equal(worker.request('https://tiles.openfreemap.org/tiles/1/1/1.pbf'), undefined)
})

test('캐시 저장에 실패해도 온라인 응답은 정상 표시한다', async () => {
  const worker = createWorker(
    async () => cacheableResponse('facilities'),
    ['https://api.example.com/facilities'],
    async () => { throw new Error('quota exceeded') },
  )

  assert.equal(await (await worker.request('https://api.example.com/facilities')).text(), 'facilities')
})

test('사전 캐시된 앱 셸은 오프라인에서도 탐색과 에셋 요청에 응답한다', async () => {
  const listeners = new Map()
  const stored = new Map()
  const scope = 'https://app.example.com/'
  const cache = {
    addAll: async (urls) => {
      for (const url of urls) stored.set(url, new Response(url))
    },
    match: async (request) => stored.get(typeof request === 'string' ? request : request.url),
  }
  const self = {
    registration: { scope },
    location: { href: `${scope}sw.js` },
    addEventListener: (type, listener) => listeners.set(type, listener),
    skipWaiting() {},
  }
  const source = readFileSync(join(__dirname, '../public/sw.js'), 'utf8')
    .replace('/* __PRECACHE_MANIFEST__ */ []', '["index.html","assets/app.js","assets/app.css"]')
  runInNewContext(source, {
    self,
    caches: { open: async () => cache },
    fetch: async () => { throw new Error('offline') },
    URL,
  })

  let installPromise
  listeners.get('install')({ waitUntil: (promise) => { installPromise = promise } })
  await installPromise

  function request(url, mode) {
    let responsePromise
    listeners.get('fetch')({
      request: { url, mode, method: 'GET', headers: new Headers() },
      respondWith: (promise) => { responsePromise = promise },
    })
    return responsePromise
  }

  assert.equal(await (await request(`${scope}trails`, 'navigate')).text(), `${scope}index.html`)
  assert.equal(await (await request(`${scope}assets/app.js`, 'same-origin')).text(), `${scope}assets/app.js`)
  assert.equal(request('https://tiles.openfreemap.org/styles/liberty', 'same-origin'), undefined)
})
