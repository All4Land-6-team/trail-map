type Snapshot = { height: number; customized: boolean };

/** A session survives pause/resume, but never overwrites a user's newer sheet choice. */
export function createSheetPreviewSession() {
  let snapshot: Snapshot | null = null;
  let active = false;
  return {
    get active() { return active; },
    begin(height: number, customized: boolean) {
      if (active) return false;
      active = true;
      snapshot = { height, customized };
      return true;
    },
    invalidate() { snapshot = null; },
    end() {
      const result = snapshot;
      snapshot = null;
      active = false;
      return result;
    },
  };
}
