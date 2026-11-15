import { authHeaders } from '../store/authStore.ts'

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '')

export type MountainDto = {
  mountainId: number
  externalId: string | null
  name: string
  longitude: number
  latitude: number
}

export const mountainApi = {
  list: async (signal?: AbortSignal) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/mountains`, { signal, headers: authHeaders() })
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { message?: string }
      throw new Error(error.message || '산 정보를 불러오지 못했습니다.')
    }
    return ((await response.json()) as { data: MountainDto[] }).data
  },
}
