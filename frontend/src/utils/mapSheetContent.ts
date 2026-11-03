/** 스크롤 영역의 현재 높이 대신, 늘어나지 않는 내부 콘텐츠와 시트의 여백을 합산한다. */
export function measureMapSheetContent(sheet: HTMLElement, content: HTMLElement) {
  const body = sheet.querySelector<HTMLElement>(".af-bottom-sheet__body");
  const viewport = sheet.querySelector<HTMLElement>(".af-bottom-sheet__content");
  if (!body || !viewport || !viewport.contains(content)) return undefined;

  const number = (value: string) => Number.parseFloat(value) || 0;
  const margins = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    return number(style.marginTop) + number(style.marginBottom);
  };
  const edges = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    return number(style.paddingTop) + number(style.paddingBottom)
      + number(style.borderTopWidth) + number(style.borderBottomWidth);
  };
  const children = (element: HTMLElement) => Array.from(element.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement && getComputedStyle(child).display !== "none");
  const gap = (element: HTMLElement) => number(getComputedStyle(element).rowGap) * Math.max(0, children(element).length - 1);
  const outerHeight = (element: HTMLElement) => element.getBoundingClientRect().height + margins(element);
  const bodyHeight = children(body).reduce((total, child) => total + (child === viewport
    ? content.getBoundingClientRect().height + margins(content) + edges(viewport) + margins(viewport)
    : outerHeight(child)), edges(body) + margins(body) + gap(body));
  return Math.ceil(children(sheet).reduce((total, child) => total + (child === body ? bodyHeight : outerHeight(child)), edges(sheet) + gap(sheet)));
}
