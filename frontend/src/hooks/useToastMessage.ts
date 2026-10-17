import { useCallback, useEffect, useState } from "react";

/** Figma 공통 규칙: Toast는 약 1.9초 뒤 사라진다. */
const TOAST_DURATION_MS = 1900;

export function useToastMessage() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  const show = useCallback((next: string) => setMessage(next), []);
  return { message, show };
}
