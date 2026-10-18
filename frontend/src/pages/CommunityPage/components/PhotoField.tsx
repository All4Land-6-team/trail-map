import { useRef } from 'react'
import { ReviewPhotoPicker } from '../../../components/review/ReviewPhotoPicker'

type Props = {
  photos: readonly string[]
  onChange: (photos: string[]) => void
  onError: (message: string) => void
  label?: string
}

export function PhotoField({ photos, onChange, onError, label = '사진 추가' }: Props) {
  const input = useRef<HTMLInputElement>(null)
  function add(files: FileList | null) {
    if (!files) return
    const incoming = Array.from(files)
    if (incoming.some(file => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024)) {
      onError('5MB 이하의 이미지 파일만 추가할 수 있어요.')
      return
    }
    if (incoming.length + photos.length > 3) {
      onError('사진은 최대 3장까지 추가할 수 있어요.')
      return
    }
    onChange([...photos, ...incoming.map(file => URL.createObjectURL(file))])
  }
  return <div className={`community-photo-field${photos.length >= 3 ? ' community-photo-field--full' : ''}`}>
    <span className="community-field-label">{label} <small>선택 · 최대 3장</small></span>
    <ReviewPhotoPicker photos={photos.map((src, index) => ({ src, alt: `${label} ${index + 1}` }))}
      onAdd={() => input.current?.click()} onRemove={index => {
        URL.revokeObjectURL(photos[index])
        onChange(photos.filter((_, photoIndex) => photoIndex !== index))
      }} />
    <input ref={input} type="file" accept="image/*" multiple hidden aria-label={label}
      onChange={event => { add(event.target.files); event.currentTarget.value = '' }} />
  </div>
}
