import { useEffect, useRef } from "react";
import { LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, TooltipComponent } from "echarts/components";
import { init, use as registerEChartsModules } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { ElevationChartSeries } from "../types";

registerEChartsModules([LineChart, AriaComponent, GridComponent, TooltipComponent, SVGRenderer]);

type CourseElevationChartProps = {
  series: readonly ElevationChartSeries[];
};

export function CourseElevationChart({ series }: CourseElevationChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = init(chartRef.current, undefined, { renderer: "svg" });
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: "선택한 코스들의 거리별 고도를 비교한 선 그래프" },
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
  }, [series]);

  return <div ref={chartRef} className="cart-elevation-chart" role="img" aria-label="코스별 고도 프로필" />;
}
