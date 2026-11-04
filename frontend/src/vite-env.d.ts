/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_MOCK_BAEGUNDAE_COURSE_ID?: string
  readonly VITE_MAP_STYLE_URL?: string
  readonly VITE_OFFLINE_STATIC_GEO_URLS?: string
  /** 개발 서버에서만: true면 코스와의 거리와 상관없이 등산을 시작할 수 있다 */
  readonly VITE_HIKE_START_ANYWHERE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
