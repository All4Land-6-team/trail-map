import { useEffect, useId, useRef, useState } from 'react'
import { spotTypeOptions } from '../../../api/communityMock'
import { Icon } from '../../../components/common/Icon'
import type { SpotType } from '../../../types/community'

type SpotTypeValue = SpotType | 'all'
const options: { value: SpotTypeValue; label: string }[] = [{ value: 'all', label: '전체 종류' }, ...spotTypeOptions]

export function SpotTypeDropdown({ value, onChange }: { value: SpotTypeValue; onChange: (value: SpotTypeValue) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const selectedLabel = value === 'all' ? '스팟 종류' : options.find(option => option.value === value)?.label ?? '스팟 종류'

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const focusOption = (index: number) => {
    const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>('.community-spot-dropdown__option')
    if (!buttons?.length) return
    buttons[(index + buttons.length) % buttons.length].focus()
  }

  return <div ref={rootRef} className="community-spot-dropdown" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); triggerRef.current?.focus() }
    if (!open || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('.community-spot-dropdown__option') ?? [])]
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Home') focusOption(0)
    else if (event.key === 'End') focusOption(buttons.length - 1)
    else focusOption((current < 0 ? options.findIndex(option => option.value === value) : current) + (event.key === 'ArrowDown' ? 1 : -1))
  }}>
    <button ref={triggerRef} type="button" className="community-spot-dropdown__trigger" aria-label={`스팟 종류 필터: ${selectedLabel}`}
      aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(current => !current)}>
      <span>{selectedLabel}</span><Icon name="ChevronDown" size={16} color="currentColor" />
    </button>
    {open && <div id={menuId} className="community-spot-dropdown__menu" role="group" aria-label="스팟 종류 선택">
      {options.map(option => <button key={option.value} type="button" className="community-spot-dropdown__option"
        aria-pressed={value === option.value} onClick={() => { onChange(option.value); setOpen(false); triggerRef.current?.focus() }}>
        <span>{option.label}</span>{value === option.value && <Icon name="Check" size={16} color="currentColor" />}
      </button>)}
    </div>}
  </div>
}
