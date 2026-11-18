import type { CourseSpot } from '../types/courseDetail'
import { distanceMeters } from '../utils/hikeTracking.ts'

const FORMAT_ERROR = '주변 장소 응답 형식이 올바르지 않아요. 다시 시도해 주세요.'

type NearbyPlace = {
  sourceType: 'KAKAO_PLACE'
  placeId: string
  name: string
  category: 'CONVENIENCE_STORE' | 'RESTAURANT' | 'CAFE'
  longitude: number
  latitude: number
  address: string
  roadAddress: string
  phone: string
  placeUrl: string
  distanceFromCourseMeters: number
}

export const COURSE_FOOD_PLACE_LIMIT = 8

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCoordinate(value: unknown, limit: number) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit
}

export function courseNearbyPlacesUrl(
  courseId: number,
  apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080',
) {
  if (!Number.isSafeInteger(courseId) || courseId < 1) throw new Error('조회할 코스가 연결되지 않았어요.')
  return `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/courses/${courseId}/nearby-places`
}

export function parseCourseNearbyPlaces(value: unknown): NearbyPlace[] {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.data)) throw new Error(FORMAT_ERROR)
  const ids = new Set<string>()
  return value.data.map((item): NearbyPlace => {
    if (!isRecord(item) || item.sourceType !== 'KAKAO_PLACE' || typeof item.placeId !== 'string' || !item.placeId
      || ids.has(item.placeId) || typeof item.name !== 'string'
      || !['CONVENIENCE_STORE', 'RESTAURANT', 'CAFE'].includes(String(item.category))
      || !isCoordinate(item.longitude, 180) || !isCoordinate(item.latitude, 90)
      || typeof item.address !== 'string' || typeof item.roadAddress !== 'string' || typeof item.phone !== 'string'
      || typeof item.placeUrl !== 'string' || !/^https:\/\/place\.map\.kakao\.com\/\d+$/.test(item.placeUrl)
      || !Number.isSafeInteger(item.distanceFromCourseMeters) || (item.distanceFromCourseMeters as number) < 0) {
      throw new Error(FORMAT_ERROR)
    }
    ids.add(item.placeId)
    return item as unknown as NearbyPlace
  })
}

export function toCourseNearbySpots(places: readonly NearbyPlace[], courseId: string, startCoordinate?: [number, number]): CourseSpot[] {
  return [...places]
    .filter(place => place.category === 'RESTAURANT' || place.category === 'CAFE')
    .sort((left, right) => (startCoordinate
      ? distanceMeters(startCoordinate, [left.longitude, left.latitude]) - distanceMeters(startCoordinate, [right.longitude, right.latitude])
      : left.distanceFromCourseMeters - right.distanceFromCourseMeters)
      || left.name.localeCompare(right.name, 'ko'))
    .slice(0, COURSE_FOOD_PLACE_LIMIT)
    .map(place => ({
      id: `kakao-${place.placeId}`,
      courseId,
      kind: place.category === 'RESTAURANT' ? 'restaurant' as const : 'cafe' as const,
      name: place.name,
      coordinate: [place.longitude, place.latitude] as [number, number],
      distanceMeters: place.distanceFromCourseMeters,
      address: place.address,
      roadAddress: place.roadAddress,
      phone: place.phone,
      placeUrl: place.placeUrl,
    }))
}

export async function loadCourseNearbyPlaces(courseId: number, signal?: AbortSignal) {
  const response = await fetch(courseNearbyPlacesUrl(courseId), {
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(response.status === 404
    ? '연결된 코스를 찾을 수 없어요. 코스 목록에서 다시 선택해 주세요.'
    : '주변 음식점과 카페를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
  return parseCourseNearbyPlaces(await response.json())
}
