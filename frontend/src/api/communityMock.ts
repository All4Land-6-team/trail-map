import { courseFixtures } from './courseMock'
import { coordinateAlongRoute } from '../utils/courseProfile'
import type { CommunityCourseReviewTarget, CommunitySpot, Coordinate, SpotType, SpotVote } from '../types/community'

/** COMM 화면 검수용 합성 데이터. 실제 위치·등산로·안전 상태가 아닙니다. */
export const communityMountains: { id: string; name: string; position: Coordinate }[] = [
  { id: 'bukhansan', name: '북한산', position: [126.977, 37.659] },
  { id: 'dobongsan', name: '도봉산', position: [127.034, 37.696] },
  { id: 'gwanaksan', name: '관악산', position: [126.964, 37.445] },
  { id: 'seoraksan', name: '설악산', position: [128.465, 38.119] },
  { id: 'jirisan', name: '지리산', position: [127.731, 35.337] },
]
export const communityCourse = courseFixtures.find(course => course.id === 'bukhansan-baegundae')!

function point(ratio: number): Coordinate {
  return coordinateAlongRoute(communityCourse.routeCoordinates, ratio)!
}

export const communitySpots: CommunitySpot[] = [
  { id: 'baegundae-rock', name: '백운대 전망 바위', type: 'photo', coordinate: point(.56), mountainId: 'bukhansan', baselinePhotos: 8, baselineReviews: 14, seedQuote: '바위 앞쪽에서 전망이 잘 보여요.', photos: [] },
  { id: `${communityCourse.id}-photo-2`, name: '사진 스팟 2', type: 'photo', coordinate: point(.85), mountainId: 'bukhansan', baselinePhotos: 0, baselineReviews: 0, photos: [] },
  { id: `${communityCourse.id}-shelter-1`, name: '쉼터 1', type: 'shelter', coordinate: point(.26), mountainId: 'bukhansan', baselinePhotos: 0, baselineReviews: 0, photos: [] },
  { id: `${communityCourse.id}-shelter-2`, name: '쉼터 2', type: 'shelter', coordinate: point(.7), mountainId: 'bukhansan', baselinePhotos: 0, baselineReviews: 0, photos: [] },
  { id: `${communityCourse.id}-water-1`, name: '음수대 1', type: 'water', coordinate: point(.4), mountainId: 'bukhansan', baselinePhotos: 0, baselineReviews: 0, photos: [] },
  { id: `${communityCourse.id}-restroom-1`, name: '화장실 1', type: 'restroom', coordinate: point(.1), mountainId: 'bukhansan', baselinePhotos: 0, baselineReviews: 0, photos: [] },
]

const courseBaselines: Record<string, { photos: number; reviews: number; quote: string }> = {
  'bukhansan-baegundae': { photos: 5, reviews: 21, quote: '정상까지 이정표가 잘 보여 코스를 따라가기 편했어요.' },
  bibong: { photos: 2, reviews: 9, quote: '바위 구간이 있어 천천히 이동했어요.' },
  daenammun: { photos: 3, reviews: 12, quote: '완만한 길이 이어져 여유롭게 걷기 좋았어요.' },
}

export const communityCourseTargets: CommunityCourseReviewTarget[] = courseFixtures.map(course => {
  const baseline = courseBaselines[course.id]
  return { id: course.id, mountainId: course.mountainId, name: course.name, coordinates: [...course.routeCoordinates] as Coordinate[],
    distanceKm: course.distanceKm, baselinePhotos: baseline?.photos ?? 0, baselineReviews: baseline?.reviews ?? 0, seedQuote: baseline?.quote ?? '' }
})
export const communityCourseTarget = communityCourseTargets.find(course => course.id === communityCourse.id)!

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
    '바위 옆에 서니 주변 능선이 한눈에 들어왔어요.',
    '정상에 오르기 전 사진 한 장 남기기 좋았어요.',
    '햇빛이 비칠 때 바위와 산 풍경이 선명했어요.',
    '사람이 지나가는 길을 비켜서 잠깐 풍경을 봤어요.',
    '가까이서 보는 바위가 생각보다 커서 인상 깊었어요.',
    '구름 사이로 보이는 산 능선이 멋졌어요.',
    '전망을 보고 나니 오르막에서 쌓인 피로가 풀렸어요.',
    '바위 주변에서 잠시 멈춰 사진을 찍었어요.',
    '멀리 이어지는 산줄기를 보며 쉬어 갔어요.',
    '친구와 번갈아 사진을 찍고 다음 길로 이동했어요.',
    '풍경이 좋아서 돌아가는 길에도 다시 들렀어요.',
  ],
  'bukhansan-baegundae': [
    '정상까지 이정표가 잘 보여 코스를 따라가기 편했어요.',
    '오르막이 이어져 천천히 걸으니 좋았어요.',
    '백운대에서 보는 풍경이 좋아 다시 걷고 싶은 코스예요.',
  ],
  bibong: [
    '바위 구간이 있어 천천히 이동했어요.',
    '능선에 오르니 시야가 탁 트였어요.',
    '갈림길의 방향 표시를 확인하며 걸었어요.',
  ],
  daenammun: [
    '완만한 길이 이어져 여유롭게 걷기 좋았어요.',
    '중간에 쉬어 갈 곳이 있어 편했어요.',
    '대남문까지 길 안내가 잘 되어 있었어요.',
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
