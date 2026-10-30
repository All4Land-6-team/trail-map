import type { HomeMountain } from "./home";
import type { AnalysisCourseReference } from "./courseAnalysis";

export type CourseDifficulty = "beginner" | "intermediate" | "advanced";
export type CourseSort = "difficulty" | "name";
export type Course = {
  id: string;
  /** 공간조회에 사용하는 DB 코스 ID. 화면 경로의 문자열 ID와 구분한다. */
  backendCourseId?: number;
  /** 분석 조회용 ID. 시설 시범 DB의 backendCourseId와 별도로 관리한다. */
  analysisReference?: AnalysisCourseReference;
  mountainId: string;
  name: string;
  routeLabel: string;
  difficulty: CourseDifficulty | null;
  distanceKm: number;
  durationMinutes: number;
  elevationGainMeters: number | null;
  peakElevationMeters: number | null;
  steepRatioPercent: number | null;
  analysisStatus: "ready" | "pending";
  detailAvailable: boolean;
  routeCoordinates: [longitude: number, latitude: number][];
};

export type CourseFilters = {
  difficulty: CourseDifficulty | "all";
  duration: "all" | "under2" | "2to4";
  minDistanceKm: number;
  maxDistanceKm: number;
  steepRatio: "all" | "20" | "10";
};
export type DetailedCourseFilters = Omit<CourseFilters, "difficulty">;
export type CourseDiscoveryData = { mountain: HomeMountain; courses: readonly Course[] };
export type CourseDiscoveryState =
  | { status: "loading" }
  | { status: "success"; data: CourseDiscoveryData }
  | { status: "missing" | "error" };

/** 후속 코스 상세·일정 등록 화면에 전달하는 최소 정보. */
export type CourseRequest = { mountainId: string; courseId: string };
