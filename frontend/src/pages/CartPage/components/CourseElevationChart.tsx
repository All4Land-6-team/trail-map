import { useEffect, useRef } from "react";
import { LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, TooltipComponent } from "echarts/components";
import { init, use as registerEChartsModules, type EChartsType } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { ElevationChartSeries } from "../types";
import { elevationAxisBounds } from "../../../utils/courseComparison";

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
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartRef.current);
    return () => { resizeObserver.disconnect(); instance.current = null; chart.dispose(); };
  }, []);

  useEffect(() => {
    const chart = instance.current;
    if (!chart) return;
    const axes = elevationAxisBounds(series);
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: ariaDescription },
      grid: { top: 10, right: 12, bottom: 32, left: 44 },
      tooltip: { trigger: "axis" },
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
        axisLabel: { color: "#8b9c91", fontSize: 10 },
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
