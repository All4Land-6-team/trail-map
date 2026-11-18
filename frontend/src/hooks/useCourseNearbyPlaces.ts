import { useCallback, useEffect, useState } from 'react'
import { loadCourseNearbyPlaces, toCourseNearbySpots } from '../api/courseNearbyPlaces'
import type { CourseFacilitiesState } from '../types/courseDetail'

export function useCourseNearbyPlaces(courseId: string, backendCourseId: number | undefined, enabled: boolean,
  startCoordinate?: [number, number]) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; state: CourseFacilitiesState } | null>(null)
  const startLongitude = startCoordinate?.[0]
  const startLatitude = startCoordinate?.[1]
  const key = `${courseId}/${backendCourseId}/${startLongitude ?? ''},${startLatitude ?? ''}/${attempt}`
  const connected = backendCourseId !== undefined && Number.isSafeInteger(backendCourseId) && backendCourseId > 0

  useEffect(() => {
    if (!enabled || !connected || backendCourseId === undefined) return
    const controller = new AbortController()
    loadCourseNearbyPlaces(backendCourseId, controller.signal).then(places => {
      if (!controller.signal.aborted) {
        const start = startLongitude === undefined || startLatitude === undefined
          ? undefined : [startLongitude, startLatitude] as [number, number]
        setResult({ key, state: { status: 'success', spots: toCourseNearbySpots(places, courseId, start) } })
      }
    }).catch(error => {
      if (!controller.signal.aborted) {
        setResult({ key, state: { status: 'error', message: error instanceof Error ? error.message : '주변 장소를 불러오지 못했어요.' } })
      }
    })
    return () => controller.abort()
  }, [backendCourseId, connected, courseId, enabled, key, startLatitude, startLongitude])

  const state: CourseFacilitiesState = !connected ? { status: 'unavailable' }
    : result?.key === key ? result.state : { status: 'loading' }
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  return { state, retry }
}
