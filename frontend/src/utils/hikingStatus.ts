export type LocationGuideState = "denied" | "blocked" | "unavailable";

export function resolveLocationGuideState(
  errorCode: number,
  wasBlockedBeforeRequest = false,
): LocationGuideState {
  if (errorCode !== 1) return "unavailable";
  return wasBlockedBeforeRequest ? "blocked" : "denied";
}
