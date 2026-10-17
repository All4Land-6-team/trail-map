export type ElevationPoint = {
  distanceKm: number;
  elevationMeters: number;
};

export type CartCourse = {
  id: string;
  name: string;
  shortName: string;
  mountain: string;
  distanceKm: number;
  durationMinutes: number;
  color: string;
  routeCoordinates: [longitude: number, latitude: number][];
  elevationProfile: ElevationPoint[];
};

export type ElevationChartSeries = {
  id: string;
  name: string;
  color: string;
  points: ElevationPoint[];
};
