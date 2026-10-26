/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_MOCK_BAEGUNDAE_COURSE_ID?: string
  /** 커뮤니티·등산 일정·닉네임 API 요청에 사용할 X-User-Id (기본 1) */
  readonly VITE_HIKE_USER_ID?: string
  readonly VITE_MAP_STYLE_URL?: string
  readonly VITE_OFFLINE_STATIC_GEO_URLS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
