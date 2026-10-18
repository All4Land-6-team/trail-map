export type ReviewKind = 'mountain' | 'spot' | 'segment'
export type SpotType = 'shelter' | 'water' | 'restroom' | 'photo' | 'other'
export type SegmentStatus = 'good' | 'caution' | 'danger'
export type Coordinate = [longitude: number, latitude: number]

export type CommunitySpot = {
  id: string
  name: string
  type: SpotType
  coordinate: Coordinate
  mountainId: string
  baselinePhotos: number
  baselineReviews: number
  seedQuote?: string
  photos: string[]
  userCreated?: boolean
}

export type CommunitySegment = {
  id: string
  name: string
  courseId: string
  coordinates: Coordinate[]
  distanceKm: number
  baselinePhotos: number
  baselineReviews: number
  baselineStatus?: SegmentStatus
  seedQuote: string
}

export type CommunityReview = {
  id: string
  kind: ReviewKind
  targetId: string
  content: string
  photos: string[]
  rating?: number
  status?: SegmentStatus
  segmentCoordinates?: Coordinate[]
  segmentVia?: Coordinate
  createdAt: string
}

export type ReviewDraft = {
  kind: ReviewKind
  targetId: string
  content: string
  photos: string[]
  rating: number
  status: SegmentStatus | null
  segmentCoordinates?: Coordinate[]
  segmentVia?: Coordinate
}

export type SpotVote = {
  yes: number
  no: number
  viewer: 'yes' | 'no' | null
}
