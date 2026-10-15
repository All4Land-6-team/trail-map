import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./review.css";

type PhotoSlotProps = {
  src?: string;
  alt?: string;
  onRemove?: () => void;
  onAdd?: () => void;
};

function PhotoSlot({ src, alt = "첨부 사진", onRemove, onAdd }: PhotoSlotProps) {
  if (!src) return <button type="button" className="af-photo-slot af-photo-slot--add"
    onClick={onAdd} aria-label="사진 추가"><Icon name="Plus" size={28} /></button>;
  return <div className="af-photo-slot af-photo-slot--photo">
    <img src={src} alt={alt} className="af-photo-slot__image" />
    <button type="button" className="af-photo-slot__remove" aria-label="사진 삭제" onClick={onRemove}>×</button>
  </div>;
}

export type ReviewPhotoPickerProps = {
  photos: readonly { src: string; alt?: string }[];
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  className?: string;
};

export function ReviewPhotoPicker({ photos, onAdd, onRemove, className }: ReviewPhotoPickerProps) {
  return <div className={["af-photo-picker", className].filter(Boolean).join(" ")}>
    {photos.map((photo, index) => <PhotoSlot key={`${photo.src}-${index}`} {...photo}
      onRemove={() => onRemove?.(index)} />)}
    <PhotoSlot onAdd={onAdd} />
  </div>;
}
