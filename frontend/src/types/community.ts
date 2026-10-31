export type ReviewKind = 'mountain' | 'spot' | 'course'
export type SpotType = 'shelter' | 'water' | 'restroom' | 'photo' | 'other'
export type CommunitySpotTargetType = 'FACILITY' | 'USER_SPOT'
export type Coordinate = [longitude: number, latitude: number]

export type PendingPhoto = {
  file: File
  previewUrl: string
}

export type CommunitySpot = {
  /** targetType과 DB ID를 합친 화면 내부 식별자. facility_id와 spot_id는 서로 겹칠 수 있다. */
  id: string
  targetId: string
  targetType: CommunitySpotTargetType
  name: string
  type: SpotType
  coordinate: Coordinate
  mountainId: string
  baselinePhotos: number
  baselineReviews: number
  seedQuote?: string
  photos: string[]
  status?: string
}

export type CommunityCourseReviewTarget = {
  id: string
  externalId?: string
  mountainId: string
  name: string
  coordinates: Coordinate[]
  distanceKm: number
  baselinePhotos: number
  baselineReviews: number
  seedQuote: string
}

export type CommunityReview = {
  id: string
  kind: ReviewKind
  targetId: string
  content: string
  photos: string[]
  rating?: number
  /** 작성자 닉네임 (내 등산에서 설정, 기본 익명{userId}). 이 칸이 생기기 전 후기는 '나'로 보여 준다 */
  author?: string
  createdAt: string
}

export type ReviewDraft = {
  kind: ReviewKind
  targetId: string
  content: string
  photos: PendingPhoto[]
  rating: number
  completedHikeId?: string
}

export type SpotVote = {
  yes: number
  no: number
  viewer: 'yes' | 'no' | null
}
