import type { Course } from "./course";
import type { ElevationPoint } from "./chart";
import type { SpotKind } from "../components/map/SpotMarker";

export type CourseProfileSample = ElevationPoint & {
  slopePercent: number;
  coordinate: [longitude: number, latitude: number];
};
export type ProfileVisibility = { elevation: boolean; slope: boolean };
export type CourseSpot = {
  id: string;
  courseId: string;
  kind: SpotKind;
  name: string;
  coordinate: [longitude: number, latitude: number];
};
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
  samples: readonly CourseProfileSample[];
  spots: readonly CourseSpot[];
};
export type CourseDetailState =
  | { status: "loading" }
  | { status: "success"; data: CourseDetailData }
  | { status: "missing" | "error" };
