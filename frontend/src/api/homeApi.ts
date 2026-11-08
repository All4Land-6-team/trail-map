import { communityApi } from './community'
import type { HomeDiscoveryData, HomeMountain } from '../types/home'

function toHomeMountain(mountain: Awaited<ReturnType<typeof communityApi.mountains>>[number]): HomeMountain {
  return {
    id: mountain.externalId ?? String(mountain.mountainId),
    name: mountain.name,
    position: [mountain.longitude, mountain.latitude],
  }
}

/** 홈 산 탐색은 백엔드의 공통 산 기본 정보 목록을 사용한다. */
export async function loadHomeDiscoveryData(signal: AbortSignal): Promise<HomeDiscoveryData> {
  const mountains = (await communityApi.mountains(signal)).map(toHomeMountain)
  signal.throwIfAborted()

  const preferred = mountains.filter(mountain => mountain.id === 'bukhansan' || mountain.id === 'dobongsan')
  const fallback = preferred.length > 0 ? preferred : mountains.slice(0, 2)
  return {
    mountains,
    recommendedMountainIds: fallback.map(mountain => mountain.id),
    initialRecentMountainIds: fallback.map(mountain => mountain.id),
    schedules: [],
  }
}
