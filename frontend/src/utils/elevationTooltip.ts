const decimal = (value: number, digits: number) => value.toLocaleString('ko-KR', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);

/** ECharts의 2차원 원본 값은 보존하고 툴팁의 표시만 반올림한다. */
export function formatElevationTooltip(params: unknown): string {
  const items = (Array.isArray(params) ? params : [params]).flatMap(item => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    const values = Array.isArray(row.value) ? row.value : row.data;
    if (!Array.isArray(values) || !finite(values[0])) return [];
    return [{ distanceKm: values[0], elevation: finite(values[1]) ? `${decimal(values[1], 1)} m` : '—',
      name: typeof row.seriesName === 'string' ? row.seriesName : '코스',
      color: typeof row.color === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(row.color) ? row.color : '#617b6c' }];
  });
  if (!items.length) return '';
  return `<div class="cart-elevation-tooltip__header">거리 ${decimal(items[0].distanceKm, 2)} km</div>`
    + items.map(item => `<div class="cart-elevation-tooltip__row">`
      + `<span class="cart-elevation-tooltip__marker" style="background:${item.color}"></span>`
      + `<span class="cart-elevation-tooltip__name">${escapeHtml(item.name)}</span>`
      + `<strong>${item.elevation}</strong></div>`).join('');
}

export type TooltipBounds = { left: number; top: number; right: number; bottom: number };

/** 좌표는 차트 기준이다. 작은 화면에서는 차트 위쪽 공간도 사용해 내비게이션을 가리지 않는다. */
export function positionElevationTooltip(point: readonly number[], size: readonly number[], bounds: TooltipBounds): [number, number] {
  const x = Math.min(Math.max(point[0] + 12, bounds.left), Math.max(bounds.left, bounds.right - size[0]));
  const y = Math.min(Math.max(point[1] + 12, bounds.top), Math.max(bounds.top, bounds.bottom - size[1]));
  return [x, y];
}
