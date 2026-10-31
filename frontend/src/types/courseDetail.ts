import type { Course } from "./course";
import type { SpotKind } from "../components/map/SpotMarker";

export type CourseProfileSample = {
  distanceKm: number;
  elevationMeters: number | null;
  slopePercent: number | null;
  coordinate: [longitude: number, latitude: number];
};
export type ProfileVisibility = { elevation: boolean; slope: boolean };
export type CourseSpot = {
  id: string;
  courseId: string;
  kind: SpotKind;
  name: string;
  coordinate: [longitude: number, latitude: number];
  facilityId?: number;
  distanceMeters?: number;
  sourceDate?: string | null;
};
export type CourseFacilitiesState =
  | { status: "unavailable" | "loading" }
  | { status: "success"; spots: readonly CourseSpot[] }
  | { status: "error"; message: string };
export type SpotCategory = SpotKind | "all" | "control";
export type CourseDetailTab = "analysis" | "spots";
export type CourseDetailView = { tab: CourseDetailTab; category: SpotCategory; spotId?: string };
export type CourseSpotRequest = {
  mountainId: string;
  courseId: string;
  spotId: string;
  category: SpotCategory;
  returnPath: string;
};
export type CourseDetailData = {
  course: Course;
  spots: readonly CourseSpot[];
};
export type CourseDetailState =
  | { status: "loading" }
  | { status: "success"; data: CourseDetailData }
  | { status: "missing" | "error" };
