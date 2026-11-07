export type PlannedHike = {
  date: string;
  time: string;
  courseId: string;
  mountain: string;
  courseName: string;
  distanceKm?: number;
};

/** 저장 실패를 등록창에 전달하며, 대체 확인을 거친 경우에만 replaceExisting을 보낸다. */
export type PlanHike = (hike: PlannedHike, options: { replaceExisting: boolean }) => Promise<void>;
