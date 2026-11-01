import type { CommunitySpotTargetType, Coordinate, PendingPhoto, ReviewKind, SpotType } from '../types/community'

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '')
const USER_ID = import.meta.env?.VITE_HIKE_USER_ID || '1'

type SuccessResponse<T> = { data: T }
type ApiErrorResponse = { message?: string }

export type CommunityMountainDto = {
  mountainId: number
  externalId: string | null
  name: string
  longitude: number
  latitude: number
}

export type CommunityCourseDto = {
  courseId: number
  mountainId: number
  externalId: string | null
  name: string
  distanceKm: number
  reviewCount: number
  photoCount: number
  representativePhotoUrl: string | null
  coordinates: { longitude: number; latitude: number }[]
}

export type CommunitySpotDto = {
  targetType: CommunitySpotTargetType
  targetId: number
  mountainId: number
  name: string
  type: 'REST_AREA' | 'DRINKING_FOUNTAIN' | 'RESTROOM' | 'PHOTO_SPOT' | 'OTHER'
  longitude: number
  latitude: number
  status: string
  yesVotes: number
  noVotes: number
  viewerVote: 'YES' | 'NO' | null
  reviewCount: number
  photoCount: number
  representativePhotoUrl: string | null
}

export type CommunitySpotBounds = { west: number; south: number; east: number; north: number }
export type CommunityMapSpotDto = Omit<CommunitySpotDto, 'reviewCount' | 'photoCount' | 'representativePhotoUrl'>
export type CommunitySpotPageDto = { items: CommunitySpotDto[]; nextCursor: string | null; hasNext: boolean }

export type CommunityReviewDto = {
  reviewId: number
  kind: 'MOUNTAIN' | 'COURSE' | 'SPOT'
  targetId: number
  hikeRecordId: number | null
  author: string
  content: string
  rating: number | null
  visitedDate: string | null
  createdAt: string
  photoUrls: string[]
}

export type CommunityMountainReviewSummaryDto = { reviewCount: number; averageRating: number | null; photoCount: number }
export type CommunityReviewPreviewDto = { reviews: CommunityReviewDto[]; photos: CommunityPhotoDto[] }
export type CommunityMountainPreviewDto = CommunityReviewPreviewDto & { summary: CommunityMountainReviewSummaryDto }

export type EligibleHikeDto = {
  hikeRecordId: number
  courseId: number
  courseName: string
  endedAt: string
}

export type CommunityEligibilityDto = { hikes: EligibleHikeDto[] }

export type CommunityPhotoDto = {
  photoId: number
  url: string
  originalFileName: string
  mediaType: string
  fileSizeBytes: number
  displayOrder: number
  author: string
  reviewContent: string | null
  createdAt: string
  reviewRating: number | null
}

export type CreatedSpotDto = {
  spotId: number
  mountainId: number
  name: string
  type: CommunitySpotDto['type']
  longitude: number
  latitude: number
  status: string
}

export type SpotVoteDto = {
  targetType: CommunitySpotDto['targetType']
  targetId: number
  yesVotes: number
  noVotes: number
  viewerVote: 'YES' | 'NO' | null
  status: string
}

export class CommunityApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1/community${path}`, {
    ...init,
    headers: {
      'X-User-Id': USER_ID,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ApiErrorResponse
    throw new CommunityApiError(error.message || '커뮤니티 요청을 처리하지 못했습니다.', response.status)
  }
  return ((await response.json()) as SuccessResponse<T>).data
}

export const communityApi = {
  mountains: (signal?: AbortSignal) => request<CommunityMountainDto[]>('/mountains', { signal }),
  courses: (mountainId: string, signal?: AbortSignal) =>
    request<CommunityCourseDto[]>(`/mountains/${mountainId}/courses`, { signal }),
  spots: (mountainId: string, bounds: CommunitySpotBounds, signal?: AbortSignal, type?: CommunitySpotDto['type']) => {
    const query = new URLSearchParams({
      west: String(bounds.west), south: String(bounds.south), east: String(bounds.east), north: String(bounds.north),
    })
    if (type) query.set('type', type)
    return request<CommunityMapSpotDto[]>(`/mountains/${mountainId}/spots/map?${query}`, { signal })
  },
  spotList: (mountainId: string, signal?: AbortSignal, type?: CommunitySpotDto['type'], cursor?: string) => {
    const query = new URLSearchParams({ size: '20' })
    if (type) query.set('type', type)
    if (cursor) query.set('cursor', cursor)
    return request<CommunitySpotPageDto>(`/mountains/${mountainId}/spots/list?${query}`, { signal })
  },
  spotDetail: (mountainId: string, targetType: CommunitySpotDto['targetType'], targetId: string, signal?: AbortSignal) =>
    request<CommunitySpotDto>(`/mountains/${mountainId}/spots/${targetType}/${targetId}`, { signal }),
  mountainReviews: (mountainId: string, signal?: AbortSignal, limit = 100, offset = 0) =>
    request<CommunityReviewDto[]>(`/mountains/${mountainId}/reviews?limit=${limit}&offset=${offset}`, { signal }),
  mountainPreview: (mountainId: string, signal?: AbortSignal) =>
    request<CommunityMountainPreviewDto>(`/mountains/${mountainId}/preview`, { signal }),
  coursePreview: (courseId: string, signal?: AbortSignal) =>
    request<CommunityReviewPreviewDto>(`/courses/${courseId}/preview`, { signal }),
  spotPreview: (mountainId: string, targetType: CommunitySpotDto['targetType'], targetId: string, signal?: AbortSignal) =>
    request<CommunityReviewPreviewDto>(`/mountains/${mountainId}/spots/${targetType}/${targetId}/preview`, { signal }),
  courseReviews: (courseId: string, signal?: AbortSignal, limit = 100, offset = 0) =>
    request<CommunityReviewDto[]>(`/courses/${courseId}/reviews?limit=${limit}&offset=${offset}`, { signal }),
  spotReviews: (mountainId: string, targetType: CommunitySpotDto['targetType'], targetId: string, signal?: AbortSignal, limit = 100, offset = 0) =>
    request<CommunityReviewDto[]>(`/mountains/${mountainId}/spots/${targetType}/${targetId}/reviews?limit=${limit}&offset=${offset}`, { signal }),
  mountainPhotos: (mountainId: string, signal?: AbortSignal, limit = 11, offset = 0) =>
    request<CommunityPhotoDto[]>(`/mountains/${mountainId}/photos?limit=${limit}&offset=${offset}`, { signal }),
  coursePhotos: (courseId: string, signal?: AbortSignal, limit = 11, offset = 0) =>
    request<CommunityPhotoDto[]>(`/courses/${courseId}/photos?limit=${limit}&offset=${offset}`, { signal }),
  spotPhotos: (mountainId: string, targetType: CommunitySpotDto['targetType'], targetId: string, signal?: AbortSignal, limit = 11, offset = 0) =>
    request<CommunityPhotoDto[]>(`/mountains/${mountainId}/spots/${targetType}/${targetId}/photos?limit=${limit}&offset=${offset}`, { signal }),
  mountainEligibility: (mountainId: string, signal?: AbortSignal) =>
    request<CommunityEligibilityDto>(`/mountains/${mountainId}/review-eligibility`, { signal }),
  eligibleHikes: (mountainId: string, signal?: AbortSignal) =>
    request<CommunityEligibilityDto>(`/mountains/${mountainId}/eligible-hikes`, { signal }),
  courseEligibility: (courseId: string, signal?: AbortSignal) =>
    request<CommunityEligibilityDto>(`/courses/${courseId}/review-eligibility`, { signal }),
  spotEligibility: (mountainId: string, targetType: CommunitySpotDto['targetType'], targetId: string, signal?: AbortSignal) =>
    request<CommunityEligibilityDto>(`/mountains/${mountainId}/spots/${targetType}/${targetId}/review-eligibility`, { signal }),
  createReview: (kind: ReviewKind, mountainId: string, targetId: string, targetType: CommunitySpotDto['targetType'] | undefined,
    body: { hikeRecordId: number; content: string; rating?: number }) => {
    const path = kind === 'mountain' ? `/mountains/${mountainId}/reviews`
      : kind === 'course' ? `/courses/${targetId}/reviews`
        : `/mountains/${mountainId}/spots/${targetType}/${targetId}/reviews`
    return request<CommunityReviewDto>(path, { method: 'POST', body: JSON.stringify(body) })
  },
  createSpot: (mountainId: string, body: { hikeRecordId: number; type: SpotType; name: string; coordinate: Coordinate; confirmDistinct: boolean }) =>
    request<CreatedSpotDto>(`/mountains/${mountainId}/spots`, {
      method: 'POST',
      body: JSON.stringify({
        hikeRecordId: body.hikeRecordId,
        type: toSpotType(body.type),
        name: body.name,
        longitude: body.coordinate[0],
        latitude: body.coordinate[1],
        confirmDistinct: body.confirmDistinct,
      }),
    }),
  vote: (mountainId: string, targetType: CommunitySpotDto['targetType'], targetId: string, vote: 'yes' | 'no') =>
    request<SpotVoteDto>(`/mountains/${mountainId}/spots/${targetType}/${targetId}/vote`, {
      method: 'PUT', body: JSON.stringify({ voteType: vote.toUpperCase() }),
    }),
  cancelVote: (mountainId: string, targetType: CommunitySpotDto['targetType'], targetId: string) =>
    request<SpotVoteDto>(`/mountains/${mountainId}/spots/${targetType}/${targetId}/vote`, { method: 'DELETE' }),
  uploadPhotos,
}

async function uploadPhotos(
  targetType: 'MOUNTAIN_REVIEW' | 'COURSE_REVIEW' | 'SPOT_REVIEW' | 'USER_SPOT',
  targetId: number,
  photos: readonly PendingPhoto[],
) {
  const uploaded: CommunityPhotoDto[] = []
  for (const [displayOrder, photo] of photos.entries()) {
    const metadata = {
      targetType,
      targetId,
      originalFileName: photo.file.name,
      mediaType: photo.file.type,
      fileSizeBytes: photo.file.size,
      displayOrder,
    }
    const upload = await request<{ objectKey: string; uploadUrl: string }>('/photos/upload-url', {
      method: 'POST', body: JSON.stringify(metadata),
    })
    const r2Response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': photo.file.type },
      body: photo.file,
    })
    if (!r2Response.ok) throw new CommunityApiError('R2 사진 업로드에 실패했습니다.', r2Response.status)
    uploaded.push(await request<CommunityPhotoDto>('/photos', {
      method: 'POST', body: JSON.stringify({ ...metadata, objectKey: upload.objectKey }),
    }))
  }
  return uploaded
}

export function toSpotType(type: SpotType): CommunitySpotDto['type'] {
  const types: Record<SpotType, CommunitySpotDto['type']> = {
    shelter: 'REST_AREA', water: 'DRINKING_FOUNTAIN', restroom: 'RESTROOM', photo: 'PHOTO_SPOT', other: 'OTHER',
  }
  return types[type]
}

export function fromSpotType(type: CommunitySpotDto['type']): SpotType {
  const types: Record<CommunitySpotDto['type'], SpotType> = {
    REST_AREA: 'shelter', DRINKING_FOUNTAIN: 'water', RESTROOM: 'restroom', PHOTO_SPOT: 'photo', OTHER: 'other',
  }
  return types[type]
}
