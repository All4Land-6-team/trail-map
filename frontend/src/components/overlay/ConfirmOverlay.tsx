import { useCallback } from "react";
import { useSingleFlight } from "../../hooks/useSingleFlight";
import { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
import { OverlayLayer } from "./OverlayLayer";

export type ConfirmOverlayProps = Omit<ConfirmDialogProps, "onConfirm" | "onCancel" | "confirmDisabled"> & {
  onConfirm: () => void | Promise<void>;
  /** 취소 버튼에서 호출한다. onDismiss가 없으면 배경 클릭과 Esc에서도 호출한다. */
  onCancel: () => void;
  /** 배경 클릭, Esc에서 호출한다. 취소 버튼과 다르게 처리할 때만 넘긴다. */
  onDismiss?: () => void;
};

/** 배경을 덮는 확인 창. 확정 동작이 끝날 때까지 다시 누를 수 없다. */
export function ConfirmOverlay({ onConfirm, onCancel, onDismiss = onCancel, ...dialogProps }: ConfirmOverlayProps) {
  const { run, pending } = useSingleFlight(onConfirm);
  const cancel = useCallback(() => {
    if (!pending) onCancel();
  }, [pending, onCancel]);
  const dismiss = useCallback(() => {
    if (!pending) onDismiss();
  }, [pending, onDismiss]);

  return <OverlayLayer onDismiss={dismiss}>
    <ConfirmDialog {...dialogProps} aria-busy={pending} confirmDisabled={pending}
      onCancel={cancel} onConfirm={() => void run()} />
  </OverlayLayer>;
}
