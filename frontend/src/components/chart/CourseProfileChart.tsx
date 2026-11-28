import { useEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, MarkLineComponent, TitleComponent, VisualMapPiecewiseComponent } from "echarts/components";
import { init, use as registerEChartsModules, type EChartsType } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { CourseProfileSample, ProfileVisibility } from "../../types/courseDetail";
import { nearestProfileIndex } from "../../utils/courseProfile";
import { courseProfileAxes, formatProfileValue, profileSlopeDirection, profileSlopeSectionAt, type SlopeSection } from "../../utils/courseDetailAnalysis";

// #14 CourseElevationChart의 모듈 등록·SVG 렌더링·ResizeObserver 방식을 공용 그래프로 확장.
registerEChartsModules([LineChart, AriaComponent, GridComponent, MarkLineComponent, TitleComponent, VisualMapPiecewiseComponent, SVGRenderer]);
const GRID = { top: 32, right: 18, bottom: 42, left: 58 };
type Props = {
  samples: readonly CourseProfileSample[];
  visibility: ProfileVisibility;
  selectedIndex: number;
  onSelect: (index: number) => void;
  slopeMode: 'summary' | 'raw';
  slopeSections: readonly SlopeSection[];
  steepThreshold: number | null;
  highlightedSections?: readonly SlopeSection[];
};

export function CourseProfileChart({ samples, visibility, selectedIndex, onSelect, slopeMode, slopeSections, steepThreshold, highlightedSections = [] }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const dragging = useRef<number | null>(null);
  const sample = samples[selectedIndex];
  const distance = samples.at(-1)?.distanceKm ?? 0;
  const stacked = visibility.elevation && visibility.slope;
  const slopeData = useMemo(() => {
    if (slopeMode === 'raw') return samples.map(point => [point.distanceKm, point.slopePercent]);
    const points: (number | null)[][] = [];
    let previousEnd = -1;
    for (const section of slopeSections) {
      if (previousEnd >= 0 && section.startKm > previousEnd) points.push([section.startKm, null]);
      points.push([section.startKm, section.slopePercent], [section.endKm, section.slopePercent]);
      previousEnd = section.endKm;
    }
    return points;
  }, [samples, slopeMode, slopeSections]);

  useEffect(() => {
    if (!host.current) return;
    const chart = init(host.current, undefined, { renderer: "svg" });
    chartRef.current = chart;
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(host.current);
    return () => { resizeObserver.disconnect(); chartRef.current = null; chart.dispose(); };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !sample) return;
    const axes = courseProfileAxes(samples, slopeData.map(point => point[1]));
    const { distanceMax, elevationMin, elevationMax } = axes;
    const thresholdExtent = steepThreshold === null ? 0 : Math.ceil(steepThreshold * 1.25 / 5) * 5;
    const slopeMin = Math.min(axes.slopeMin, -thresholdExtent);
    const slopeMax = Math.max(axes.slopeMax, thresholdExtent);
    const slopeAxis = stacked ? 1 : 0;
    const summary = profileSlopeSectionAt(slopeSections, sample.distanceKm);
    const selectedSlope = slopeMode === 'summary' ? summary?.slopePercent ?? null : sample.slopePercent;
    const slopeColor = selectedSlope === null ? '#617b6c' : selectedSlope < 0 ? '#286b9b' : '#a75212';
    const xAxis = (gridIndex: number, show: boolean) => ({ type: 'value', gridIndex, min: 0, max: distanceMax, splitNumber: 3,
      name: show ? '거리 (km)' : '', nameLocation: 'middle', nameGap: 27,
      nameTextStyle: { color: '#526b60', fontSize: 11, fontFamily: 'Noto Sans KR' },
      axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { show, color: '#526b60', fontSize: 10, fontFamily: 'Noto Sans KR', hideOverlap: true, showMaxLabel: true,
        formatter: (value: number) => Number(value.toFixed(2)).toString() } });
    const yAxis = (name: string, gridIndex: number, min: number, max: number) => ({ type: 'value', gridIndex, min, max, splitNumber: 3,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#526b60', fontSize: 10, fontFamily: 'Noto Sans KR', hideOverlap: true,
        formatter: (value: number) => (name === 'slope' && value > 0 ? '+' : '') + value.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + (name === 'slope' ? '%' : '') },
      splitLine: { lineStyle: { color: '#e4ebe4' } } });
    const cursor = (id: string, axisIndex: number, bounds: number[]) => ({ id, name: '선택 위치', type: 'line', xAxisIndex: axisIndex, yAxisIndex: axisIndex,
      data: bounds.map(value => [sample.distanceKm, value]), symbol: 'none', silent: true,
      lineStyle: { color: '#7b9b8a', width: 1, type: 'dashed' }, z: 3 });
    const title = (text: string, top: number) => ({ text, left: GRID.left - 5, top, padding: 0,
      textStyle: { fontSize: 11, fontWeight: 600, color: '#34584a', fontFamily: 'Noto Sans KR' } });
    chartRef.current.setOption({
      animation: false,
      aria: { enabled: true, description: `코스 진행 방향의 거리별 고도와 경사도. 경사는 ${slopeMode === 'summary' ? '50m 구간 평균' : '원본'}입니다. 양수는 오르막, 음수는 내리막이며 빈 구간은 결측입니다. 좌우 방향키로 원본 위치를 선택할 수 있습니다.` },
      title: [...(visibility.elevation ? [title('고도 (m)', 5)] : []), ...(visibility.slope ? [title(`경사 (%) · ${slopeMode === 'summary' ? '50m 평균' : '원본'}`, stacked ? 166 : 5)] : [])],
      grid: stacked ? [{ ...GRID, top: 30, height: 112, bottom: undefined }, { ...GRID, top: 194 }] : GRID,
      xAxis: stacked ? [xAxis(0, false), xAxis(1, true)] : xAxis(0, true),
      yAxis: [...(visibility.elevation ? [yAxis('elevation', 0, elevationMin, elevationMax)] : []), ...(visibility.slope ? [yAxis('slope', slopeAxis, slopeMin, slopeMax)] : [])],
      visualMap: [
        ...(visibility.elevation && highlightedSections.length ? [{ type: 'piecewise', show: false, dimension: 0, seriesIndex: 0,
          pieces: [...highlightedSections].sort((a, b) => a.startKm - b.startKm)
            .map(section => ({ gte: section.startKm, lt: section.endKm, color: '#c44f2c' })),
          outOfRange: { color: '#19765b' } }] : []),
        ...(visibility.slope ? [{ type: 'piecewise', show: false, dimension: 1, seriesIndex: visibility.elevation ? 1 : 0,
        // 유한한 양 끝을 지정해야 0에만 경계가 있는 SVG gradient의 색상 역전을 피한다.
        pieces: [...(slopeMin < 0 ? [{ gte: slopeMin, lt: 0, color: '#286b9b' }] : []),
          { value: 0, color: '#617b6c' }, ...(slopeMax > 0 ? [{ gt: 0, lte: slopeMax, color: '#a75212' }] : [])] }] : []),
      ],
      series: [
        ...(visibility.elevation ? [{ id: "elevation", name: "고도", type: "line", xAxisIndex: 0, yAxisIndex: 0,
          data: samples.map(point => [point.distanceKm, point.elevationMeters]), smooth: false, connectNulls: false,
          symbol: "circle", symbolSize: (_: unknown, params: { dataIndex: number }) => params.dataIndex === selectedIndex ? 9 : 0,
          itemStyle: { color: "#fff", borderColor: "#19765b", borderWidth: 2 },
          lineStyle: { ...(highlightedSections.length ? {} : { color: '#19765b' }), width: 2 },
          areaStyle: { color: "#e4f1e7", opacity: 1 }, emphasis: { disabled: true } }] : []),
        ...(visibility.slope ? [{ id: "slope", name: "경사도", type: "line", xAxisIndex: slopeAxis, yAxisIndex: slopeAxis,
          data: slopeData, smooth: false, connectNulls: false, symbol: 'none',
          lineStyle: { width: 2 }, emphasis: { disabled: true },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: '#9baea4', type: 'dashed', width: 1 },
            label: { show: steepThreshold !== null && slopeMax - slopeMin <= steepThreshold * 10,
              position: 'insideEndTop', color: '#526b60', fontSize: 10, formatter: '{b}' },
            data: [{ yAxis: 0, lineStyle: { type: 'solid' }, label: { show: false } },
              ...(steepThreshold === null ? [] : [
                { name: `+${steepThreshold}%`, yAxis: steepThreshold }, { name: `−${steepThreshold}%`, yAxis: -steepThreshold },
              ])] } },
          { id: 'slope-selection', name: '선택 경사', type: 'line', xAxisIndex: slopeAxis, yAxisIndex: slopeAxis,
            data: [[sample.distanceKm, selectedSlope]], symbol: 'circle', symbolSize: 8, silent: true,
            itemStyle: { color: '#fff', borderColor: slopeColor, borderWidth: 2 }, z: 5 },
          cursor('slope-cursor', slopeAxis, [slopeMin, slopeMax]) ] : []),
        ...(visibility.elevation ? [cursor('elevation-cursor', 0, [elevationMin, elevationMax])] : []),
      ],
    }, { notMerge: true });
  }, [samples, sample, visibility, selectedIndex, stacked, slopeMode, slopeSections, slopeData, steepThreshold, highlightedSections]);

  // 표시 항목 수가 바뀌면 CSS 높이가 바뀐다. ResizeObserver를 기다리기 전에도 새 grid에 맞춘다.
  useEffect(() => { chartRef.current?.resize(); }, [stacked]);

  function choosePointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left - GRID.left) / Math.max(1, bounds.width - GRID.left - GRID.right)));
    const index = nearestProfileIndex(samples, ratio * Math.max(0.1, distance));
    if (index >= 0) onSelect(index);
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next = selectedIndex;
    if (event.key === "ArrowRight") next++;
    else if (event.key === "ArrowLeft") next--;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = samples.length - 1;
    else return;
    event.preventDefault();
    onSelect(Math.max(0, Math.min(samples.length - 1, next)));
  }

  return <div className={`course-profile-chart${stacked ? ' course-profile-chart--stacked' : ''}`} role="slider" tabIndex={0} aria-label="코스 프로필 위치"
    aria-valuemin={0} aria-valuemax={distance} aria-valuenow={sample?.distanceKm ?? 0}
    aria-valuetext={sample ? formatProfileValue(sample.distanceKm, "km", 2) + (visibility.elevation ? ", 고도 " + formatProfileValue(sample.elevationMeters, "m") : "") + (visibility.slope ? ", 원본 경사 " + formatProfileValue(sample.slopePercent, "%") + ', ' + profileSlopeDirection(sample.slopePercent) : "") : "분석 데이터 없음"}
    data-profile-index={selectedIndex} data-elevation={visibility.elevation} data-slope={visibility.slope}
    onKeyDown={keyDown} onPointerDown={event => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      dragging.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true });
      choosePointer(event);
    }} onPointerMove={event => { if (dragging.current === event.pointerId) choosePointer(event); }}
    onPointerUp={event => {
      if (dragging.current !== event.pointerId) return;
      choosePointer(event);
      dragging.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }} onPointerCancel={() => { dragging.current = null; }} onLostPointerCapture={() => { dragging.current = null; }}>
    <div ref={host} className="course-profile-chart__render" />
  </div>;
}
