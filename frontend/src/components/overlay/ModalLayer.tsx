import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import "./overlay.css";

type ModalLayerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  onDismiss?: () => void;
};

const FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function ModalLayer({ children, onDismiss, className, onKeyDown, ...rest }: ModalLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = Array.from(layer.parentElement?.children ?? [])
      .filter((element) => element !== layer) as HTMLElement[];
    const previousInert = siblings.map((element) => element.inert);

    siblings.forEach((element) => { element.inert = true; });
    const frameId = requestAnimationFrame(() => {
      (layer.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? layer).focus();
    });

    return () => {
      cancelAnimationFrame(frameId);
      siblings.forEach((element, index) => { element.inert = previousInert[index]; });
      previouslyFocused?.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === "Escape" && onDismiss) {
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(
      layerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    ).filter((element) => !element.closest("[inert]"));
    if (focusable.length === 0) {
      event.preventDefault();
      event.stopPropagation();
      layerRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      event.stopPropagation();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      event.stopPropagation();
      first.focus();
    }
  }

  return (
    <div
      {...rest}
      ref={layerRef}
      className={["af-modal-layer", className].filter(Boolean).join(" ")}
      role="presentation"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
