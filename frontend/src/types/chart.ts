/** #14 등산 담기 그래프와 같은 거리·고도 단위의 공용 타입. */
export type ElevationPoint = { distanceKm: number; elevationMeters: number };
export type ElevationChartSeries = {
  id: string;
  name: string;
  color: string;
  points: readonly ElevationPoint[];
};
