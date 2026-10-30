import type { AnalysisCourseReference } from '../../types/courseAnalysis';

export type ElevationPoint = {
  distanceKm: number;
  elevationMeters: number | null;
};

export type CartCourse = {
  id: string;
  mountainId?: string;
  analysisReference?: AnalysisCourseReference;
  name: string;
  shortName: string;
  mountain: string;
  distanceKm: number;
  durationMinutes: number;
  averageSlopePercent?: number;
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
