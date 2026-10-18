import { courseFixtures } from './courseMock'
import { coordinateAlongRoute } from '../utils/courseProfile'
import type { CommunitySegment, CommunitySpot, Coordinate, SpotType, SpotVote } from '../types/community'

/** COMM 화면 검수용 합성 데이터. 실제 위치·등산로·안전 상태가 아닙니다. */
export const communityMountains: { id: string; name: string; position: Coordinate }[] = [
  { id: 'bukhansan', name: '북한산', position: [126.977, 37.659] },
  { id: 'dobongsan', name: '도봉산', position: [127.034, 37.696] },
  { id: 'gwanaksan', name: '관악산', position: [126.964, 37.445] },
]
export const communityCourse = courseFixtures.find(course => course.id === 'bukhansan-baegundae')!

function point(ratio: number): Coordinate {
  return coordinateAlongRoute(communityCourse.routeCoordinates, ratio)!
}

export const communitySpots: CommunitySpot[] = [
  { id: 'baegundae-rock', name: '백운대 전망 바위', type: 'photo', coordinate: point(.56), mountainId: 'bukhansan', baselinePhotos: 8, baselineReviews: 14, seedQuote: '바위 앞쪽에서 전망이 잘 보여요.', photos: [] },
  { id: `${communityCourse.id}-shelter-1`, name: '쉼터 1', type: 'shelter', coordinate: point(.26), mountainId: 'bukhansan', baselinePhotos: 0, baselineReviews: 0, photos: [] },
  { id: `${communityCourse.id}-shelter-2`, name: '쉼터 2', type: 'shelter', coordinate: point(.7), mountainId: 'bukhansan', baselinePhotos: 0, baselineReviews: 0, photos: [] },
  { id: `${communityCourse.id}-water-1`, name: '음수대 1', type: 'water', coordinate: point(.4), mountainId: 'bukhansan', baselinePhotos: 0, baselineReviews: 0, photos: [] },
  { id: `${communityCourse.id}-restroom-1`, name: '화장실 1', type: 'restroom', coordinate: point(.1), mountainId: 'bukhansan', baselinePhotos: 0, baselineReviews: 0, photos: [] },
]

export const communitySegment: CommunitySegment = {
  id: 'baegundae-ascent', name: '백운대 오름 구간', courseId: communityCourse.id,
  coordinates: communityCourse.routeCoordinates.slice(2, 7) as Coordinate[],
  distanceKm: 1.2, baselinePhotos: 5, baselineReviews: 21,
  seedQuote: '돌계단이 많아 내려올 때 주의하세요.',
}

export const communitySegments: CommunitySegment[] = [
  { id: 'baegundae-entry', name: '백운대 초입 구간', courseId: communityCourse.id,
    coordinates: communityCourse.routeCoordinates.slice(0, 3) as Coordinate[],
    distanceKm: 0.7, baselinePhotos: 2, baselineReviews: 9, baselineStatus: 'good',
    seedQuote: '초입 길은 걷기 편하고 표지판이 잘 보여요.' },
  communitySegment,
  { id: 'baegundae-ridge', name: '백운대 능선 구간', courseId: communityCourse.id,
    coordinates: communityCourse.routeCoordinates.slice(6, 9) as Coordinate[],
    distanceKm: 0.8, baselinePhotos: 3, baselineReviews: 12, baselineStatus: 'caution',
    seedQuote: '바위 구간에서 발밑을 살피며 걸었어요.' },
]

/** 기존 후기 수의 일부만 화면 검수용으로 보여주는 합성 후기 예시. 실제 현장 정보가 아닙니다. */
export const communityReviewExamples: Record<string, readonly string[]> = {
  bukhansan: [
    '전망이 시원하고 길 안내가 잘 보여요.',
    '정상으로 가는 계단이 길어 중간에 쉬어 갔어요.',
    '이정표가 눈에 잘 띄어서 길을 찾기 편했어요.',
  ],
  'baegundae-rock': [
    '바위 앞쪽에서 전망이 잘 보여요.',
    '사진을 찍으려는 사람이 많아 잠깐 기다렸어요.',
    '잠시 쉬며 풍경을 보기 좋은 장소였어요.',
  ],
  'baegundae-ascent': [
    '돌계단이 많아 내려올 때 주의하세요.',
    '오르막이 이어져 천천히 걸으니 좋았어요.',
    '길이 좁아 마주 오는 사람과 서로 양보하며 지나갔어요.',
  ],
  'baegundae-entry': [
    '초입 길은 걷기 편하고 표지판이 잘 보여요.',
    '완만한 길을 따라 천천히 몸을 풀기 좋았어요.',
    '갈림길에서 방향 표시를 확인했어요.',
  ],
  'baegundae-ridge': [
    '바위 구간에서 발밑을 살피며 걸었어요.',
    '바람이 불어 천천히 이동했어요.',
    '능선에서 풍경을 볼 수 있었어요.',
  ],
}

export const initialSpotVotes: Record<string, SpotVote> = {
  // 숨김 흐름을 검수할 수 있도록 빈 후기 스팟에 기존 부정 평가 2건을 둔다.
  [`${communityCourse.id}-shelter-1`]: { yes: 0, no: 2, viewer: null },
}

export const spotTypeOptions: { value: SpotType; label: string; icon: 'Shelter' | 'Water' | 'Restroom' | 'Photo' | 'More' }[] = [
  { value: 'shelter', label: '쉼터', icon: 'Shelter' },
  { value: 'water', label: '음수대', icon: 'Water' },
  { value: 'restroom', label: '화장실', icon: 'Restroom' },
  { value: 'photo', label: '사진 스팟', icon: 'Photo' },
  { value: 'other', label: '기타', icon: 'More' },
]
