export type HomeMountain = {
  id: string;
  name: string;
  position: [longitude: number, latitude: number];
};

export type TodayHikeSchedule = {
  date: string;
  startTime: string;
  courseId: string;
  mountainName: string;
  courseName: string;
  phase: "planned" | "active";
};

export type HomeDiscoveryData = {
  mountains: readonly HomeMountain[];
  recommendedMountainIds: readonly string[];
  initialRecentMountainIds: readonly string[];
  schedules: readonly TodayHikeSchedule[];
};

export type HomeDiscoveryState =
  | { status: "idle" | "loading" }
  | { status: "success"; data: HomeDiscoveryData }
  | { status: "error" };
