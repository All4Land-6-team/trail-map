import { useEffect, useRef } from "react";
import { LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, TooltipComponent } from "echarts/components";
import { init, use as registerEChartsModules, type EChartsType } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { ElevationChartSeries } from "../types";
import { elevationAxisBounds } from "../../../utils/courseComparison";
import { formatElevationTooltip, positionElevationTooltip } from "../../../utils/elevationTooltip";

registerEChartsModules([LineChart, AriaComponent, GridComponent, TooltipComponent, SVGRenderer]);

type CourseElevationChartProps = {
  series: readonly ElevationChartSeries[];
  ariaDescription?: string;
  ariaLabel?: string;
};

export function CourseElevationChart({
  series,
  ariaDescription = "선택한 코스들의 거리별 고도를 비교한 선 그래프",
  ariaLabel = "코스별 고도 프로필",
}: CourseElevationChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instance = useRef<EChartsType | null>(null);
  const hasProfile = series.some(item => item.points.some(point => point.elevationMeters !== null));

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = init(chartRef.current, undefined, { renderer: "svg" });
    instance.current = chart;
    const hideTooltip = () => chart.dispatchAction({ type: "hideTip" });
    const scroller = chartRef.current.closest(".cart-compare-content");
    scroller?.addEventListener("scroll", hideTooltip, { passive: true });
    window.addEventListener("resize", hideTooltip);
    const resizeObserver = new ResizeObserver(() => { hideTooltip(); chart.resize(); });
    resizeObserver.observe(chartRef.current);
    return () => {
      scroller?.removeEventListener("scroll", hideTooltip);
      window.removeEventListener("resize", hideTooltip);
      resizeObserver.disconnect(); instance.current = null; chart.dispose();
    };
  }, []);

  useEffect(() => {
    const chart = instance.current;
    if (!chart) return;
    const axes = elevationAxisBounds(series);
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: ariaDescription },
      grid: { top: 10, right: 12, bottom: 32, left: 44 },
      tooltip: {
        trigger: "axis",
        renderMode: "html",
        className: "cart-elevation-tooltip",
        formatter: formatElevationTooltip,
        enterable: false,
        transitionDuration: 0,
        padding: 8,
        borderColor: "#cfdccd",
        borderWidth: 1,
        backgroundColor: "rgba(255,255,255,0.98)",
        textStyle: { color: "#274d3e", fontSize: 12, fontFamily: "Noto Sans KR" },
        extraCssText: "max-width: min(224px, calc(100vw - 80px)); white-space: normal; pointer-events: none;",
        // 스크롤 본문 밖에 표시하고, 앱 좌우 경계와 하단 내비게이션 위로 위치를 제한한다.
        appendTo: (container: HTMLElement) => container.closest<HTMLElement>(".cart-screen") ?? container,
        position: (point: number[], _params: unknown, _dom: unknown, _rect: unknown,
          size: { viewSize: number[]; contentSize: number[] }) => {
          const host = chartRef.current;
          if (!host) return [0, 0];
          const chartBox = host.getBoundingClientRect();
          const app = host.closest<HTMLElement>(".cart-screen");
          const frame = app?.getBoundingClientRect() ?? chartBox;
          const nav = app?.querySelector<HTMLElement>(".cart-bottom-nav")?.getBoundingClientRect();
          return positionElevationTooltip(point, size.contentSize, {
            left: Math.max(0, frame.left - chartBox.left) + 8,
            right: Math.min(size.viewSize[0], frame.right - chartBox.left) - 8,
            top: frame.top - chartBox.top + 8,
            bottom: Math.min(size.viewSize[1], (nav?.top ?? frame.bottom) - chartBox.top) - 8,
          });
        },
      },
      xAxis: {
        type: "value",
        min: 0,
        max: axes.distanceMax,
        splitNumber: 3,
        name: "km",
        nameGap: 4,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: "#8b9c91", fontSize: 10, hideOverlap: true, formatter: (value: number) => Number(value.toFixed(2)).toString() },
      },
      yAxis: {
        type: "value",
        min: axes.elevationMin,
        max: axes.elevationMax,
        splitNumber: 3,
        name: "m",
        nameGap: 2,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#8b9c91", fontSize: 10,
          formatter: (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) },
        splitLine: { lineStyle: { color: "#e1e9df" } },
      },
      series: series
        .filter((item) => item.points.length > 0)
        .map((item) => ({
          id: item.id,
          name: item.name,
          type: "line",
          data: item.points.map((point) => [point.distanceKm, point.elevationMeters]),
          connectNulls: false,
          showSymbol: false,
          itemStyle: { color: item.color },
          lineStyle: { color: item.color, width: 2.5 },
          emphasis: { disabled: true },
        })),
    }, { notMerge: true });
  }, [ariaDescription, series]);

  return <div className="cart-elevation-profile">
    {!hasProfile && <p className="cart-elevation-note">표시할 고도 프로필이 없어요.</p>}
    <div ref={chartRef} className="cart-elevation-chart" role="img" aria-label={hasProfile ? ariaLabel : "고도 분석 정보가 없어요"} />
  </div>;
}
