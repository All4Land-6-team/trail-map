export type EnvironmentPopoverPosition = { top: number; left: number }

export function environmentPopoverPosition(
  trigger: Pick<DOMRect, 'top' | 'right' | 'bottom'>,
  popover: { width: number; height: number },
  viewport: { width: number; height: number },
): EnvironmentPopoverPosition {
  const margin = 12
  const gap = 8
  const below = trigger.bottom + gap
  const above = trigger.top - popover.height - gap
  const top = below + popover.height <= viewport.height - margin ? below : Math.max(margin, above)
  const left = Math.min(Math.max(margin, trigger.right - popover.width), Math.max(margin, viewport.width - popover.width - margin))
  return { top, left }
}
