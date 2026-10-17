import { useCallback, useRef, useState } from "react";

/** 실행 중에는 같은 동작을 다시 실행하지 않는다. 연속 클릭으로 인한 중복 실행을 막는다. */
export function useSingleFlight<Args extends unknown[], Result>(
  action: (...args: Args) => Result | Promise<Result>,
) {
  const runningRef = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(async (...args: Args): Promise<Result | undefined> => {
    if (runningRef.current) return undefined;
    runningRef.current = true;
    setPending(true);
    try {
      return await action(...args);
    } finally {
      runningRef.current = false;
      setPending(false);
    }
  }, [action]);

  return { run, pending };
}
