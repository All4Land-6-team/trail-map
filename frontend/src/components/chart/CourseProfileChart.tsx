import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { LineChart } from "echarts/charts";
import { AriaComponent, GridComponent } from "echarts/components";
import { init, use as registerEChartsModules, type EChartsType } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { CourseProfileSample, ProfileVisibility } from "../../types/courseDetail";
import { nearestProfileIndex } from "../../utils/courseProfile";

// #14 CourseElevationChart의 모듈 등록·SVG 렌더링·ResizeObserver 방식을 공용 그래프로 확장.
registerEChartsModules([LineChart, AriaComponent, GridComponent, SVGRenderer]);
const GRID = { top: 16, right: 28, bottom: 43, left: 28 };
type Props = {
  samples: readonly CourseProfileSample[];
  visibility: ProfileVisibility;
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export function CourseProfileChart({ samples, visibility, selectedIndex, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const dragging = useRef<number | null>(null);
  const sample = samples[selectedIndex];
  const distance = samples.at(-1)?.distanceKm ?? 0;

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
    const elevationMin = Math.floor(Math.min(...samples.map(point => point.elevationMeters)) / 100) * 100;
    const elevationMax = Math.max(elevationMin + 1, ...samples.map(point => point.elevationMeters));
    const slopeMax = Math.max(20, ...samples.map(point => point.slopePercent));
    const cursorBounds = visibility.elevation ? [elevationMin, elevationMax] : [0, slopeMax];
    chartRef.current.setOption({
      animation: false,
      aria: { enabled: true, description: "예시 코스의 거리별 고도와 경사도. 그래프에 초점을 맞추고 좌우 방향키로 위치를 선택할 수 있습니다." },
      grid: GRID,
      xAxis: { type: "value", min: 0, max: distance, splitNumber: 4,
        name: "거리 (km)", nameLocation: "middle", nameGap: 25,
        nameTextStyle: { color: "#879d89", fontSize: 9, fontFamily: "Noto Sans KR" },
        axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { color: "#879d89", fontSize: 9, fontFamily: "Noto Sans KR", hideOverlap: true, showMaxLabel: true,
          formatter: (value: number) => value !== distance && distance - value < distance / 10 ? "" : value === 0 ? "0" : value.toFixed(1) } },
      yAxis: [
        { type: "value", show: visibility.slope, position: "left", min: 0, max: slopeMax, splitNumber: 2,
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: "#c46c68", fontSize: 9, formatter: "{value}%", fontFamily: "Noto Sans KR" },
          splitLine: { show: !visibility.elevation, lineStyle: { color: "#e4ebe4" } } },
        { type: "value", show: visibility.elevation, position: "right", min: elevationMin, max: elevationMax, interval: (elevationMax - elevationMin) / 2,
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: "#19765b", fontSize: 9, fontFamily: "Noto Sans KR" },
          splitLine: { lineStyle: { color: "#e4ebe4" } } },
      ],
      series: [
        ...(visibility.elevation ? [{ id: "elevation", name: "고도", type: "line", yAxisIndex: 1,
          data: samples.map(point => [point.distanceKm, point.elevationMeters]), smooth: 0.3,
          symbol: "circle", symbolSize: (_: unknown, params: { dataIndex: number }) => params.dataIndex === selectedIndex ? 9 : 0,
          itemStyle: { color: "#fff", borderColor: "#19765b", borderWidth: 2 },
          lineStyle: { color: "#19765b", width: 2 }, areaStyle: { color: "#e4f1e7", opacity: 1 }, emphasis: { disabled: true } }] : []),
        ...(visibility.slope ? [{ id: "slope", name: "경사도", type: "line", yAxisIndex: 0,
          data: samples.map(point => [point.distanceKm, point.slopePercent]), smooth: 0.3,
          symbol: "circle", symbolSize: (_: unknown, params: { dataIndex: number }) => params.dataIndex === selectedIndex ? 9 : 0,
          itemStyle: { color: "#fff", borderColor: "#c46c68", borderWidth: 2 },
          lineStyle: { color: "#c46c68", width: 1.7 }, emphasis: { disabled: true } }] : []),
        { id: "cursor", name: "선택 위치", type: "line", yAxisIndex: visibility.elevation ? 1 : 0,
          data: cursorBounds.map(value => [sample.distanceKm, value]), symbol: "none", silent: true,
          lineStyle: { color: "#9bb5a5", width: 1, type: "dashed" }, z: 1 },
      ],
    }, { notMerge: true });
  }, [samples, sample, distance, visibility, selectedIndex]);

  function choosePointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left - GRID.left) / Math.max(1, bounds.width - GRID.left - GRID.right)));
    const index = nearestProfileIndex(samples, ratio * distance);
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

  return <div className="course-profile-chart" role="slider" tabIndex={0} aria-label="코스 프로필 위치"
    aria-valuemin={0} aria-valuemax={distance} aria-valuenow={sample?.distanceKm ?? 0}
    aria-valuetext={sample ? `${sample.distanceKm.toFixed(1)} km${visibility.elevation ? `, 고도 약 ${sample.elevationMeters} m` : ""}${visibility.slope ? `, 경사도 약 ${sample.slopePercent}%` : ""}` : "분석 데이터 없음"}
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
