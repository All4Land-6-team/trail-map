import type { SpotType } from '../types/community'

export const spotTypeOptions: { value: SpotType; label: string; icon: 'Shelter' | 'Water' | 'Restroom' | 'Photo' | 'More' }[] = [
  { value: 'shelter', label: '쉼터', icon: 'Shelter' },
  { value: 'water', label: '음수대', icon: 'Water' },
  { value: 'restroom', label: '화장실', icon: 'Restroom' },
  { value: 'photo', label: '사진 스팟', icon: 'Photo' },
  { value: 'other', label: '기타', icon: 'More' },
]

export function communityCourseColor(courseId: string) {
  const numericId = Number(courseId)
  const seed = courseId && Number.isFinite(numericId)
    ? numericId
    : [...courseId].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 0)
  const hue = ((seed * 137.508) % 360 + 360) % 360
  return `hsl(${hue.toFixed(2)} 68% 42%)`
}
