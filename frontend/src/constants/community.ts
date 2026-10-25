import type { SpotType } from '../types/community'

export const spotTypeOptions: { value: SpotType; label: string; icon: 'Shelter' | 'Water' | 'Restroom' | 'Photo' | 'More' }[] = [
  { value: 'shelter', label: '쉼터', icon: 'Shelter' },
  { value: 'water', label: '음수대', icon: 'Water' },
  { value: 'restroom', label: '화장실', icon: 'Restroom' },
  { value: 'photo', label: '사진 스팟', icon: 'Photo' },
  { value: 'other', label: '기타', icon: 'More' },
]

export const COURSE_ROUTE_COLORS: Readonly<Record<string, string>> = {
  '백운대 코스': '#2563EB',
  '대남문 코스': '#EA580C',
  '비봉 코스': '#7C3AED',
  '숨은벽 코스': '#0F766E',
  '보국문 코스': '#DB2777',
  '우이령 코스': '#92400E',
  '사모바위 코스': '#1E3A8A',
}

const COURSE_ROUTE_FALLBACK_COLORS = Object.values(COURSE_ROUTE_COLORS)

export function communityCourseColor(courseName: string) {
  const fixedColor = COURSE_ROUTE_COLORS[courseName]
  if (fixedColor) return fixedColor

  const hash = [...courseName].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) | 0, 0)
  return COURSE_ROUTE_FALLBACK_COLORS[Math.abs(hash) % COURSE_ROUTE_FALLBACK_COLORS.length]
}
