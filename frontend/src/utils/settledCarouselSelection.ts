/** Native scrollend wins when available; the trailing timer also covers older browsers. */
export function createSettledSelection(getCandidate: () => string | undefined, select: (id: string) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let interacting = false;
  let pending = false;
  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function settle() {
    clearTimer();
    if (interacting || !pending) return;
    pending = false;
    const id = getCandidate();
    if (id) select(id);
  }
  function schedule() {
    pending = true;
    clearTimer();
    if (!interacting) timer = setTimeout(settle, 180);
  }
  return {
    schedule, settle,
    beginInteraction() { interacting = true; clearTimer(); },
    endInteraction() { interacting = false; if (pending) schedule(); },
    cancel() { clearTimer(); pending = false; interacting = false; },
  };
}
