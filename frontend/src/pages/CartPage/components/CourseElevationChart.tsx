import { useEffect, useRef } from "react";
import { LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, TooltipComponent } from "echarts/components";
import { init, use as registerEChartsModules } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { ElevationChartSeries } from "../types";

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
  const hasProfile = series.some(item => item.points.length > 0);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = init(chartRef.current, undefined, { renderer: "svg" });
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: ariaDescription },
      grid: { top: 10, right: 6, bottom: 22, left: 30 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "value",
        min: 0,
        max: 6,
        interval: 2,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: "#8b9c91", fontSize: 10, formatter: (value: number) => value === 6 ? "6 km" : `${value}` },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 800,
        interval: 400,
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
          showSymbol: false,
          lineStyle: { color: item.color, width: 2.5 },
          emphasis: { disabled: true },
        })),
    });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [ariaDescription, series]);

  return <div className="cart-elevation-profile">
    {series.some(item => item.points.length === 0) && <p className="cart-elevation-note">일부 코스의 고도 분석 정보가 아직 없어요.</p>}
    <div ref={chartRef} className="cart-elevation-chart" role="img" aria-label={hasProfile ? ariaLabel : "고도 분석 정보가 없어요"} />
  </div>;
}
