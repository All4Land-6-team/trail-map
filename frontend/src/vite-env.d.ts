/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** 로그인 전 임시 사용자 번호 (등산 일정 API X-User-Id, 기본 1) */
  readonly VITE_HIKE_USER_ID?: string
  readonly VITE_MAP_STYLE_URL?: string
  readonly VITE_OFFLINE_STATIC_GEO_URLS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
