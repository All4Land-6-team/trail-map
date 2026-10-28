import { CourseRouteMap, type CourseRouteMapProps } from "../../../components/map/CourseRouteMap";

export function CourseMap(props: CourseRouteMapProps) {
  return <CourseRouteMap {...props} showBoundaryPreview={props.mountainId === "bukhansan"} />;
}
