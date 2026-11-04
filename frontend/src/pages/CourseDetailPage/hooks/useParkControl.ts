import { useEffect, useRef, useState } from 'react';
import { loadParkControl } from '../../../api/parkControls';
import type { ParkControlState } from '../../../types/parkControl';

// CourseFlow가 코스별로 상세 화면을 새로 마운트한다. 탭 전환 중에는 요청과 펼친 본문을 유지한다.
export function useParkControl(courseId: number | undefined, mountainKey: string, enabled: boolean) {
  const [entered, setEntered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ParkControlState>({ status: 'loading' });
  const renewed = useRef(false);
  const connected = Number.isSafeInteger(courseId) && courseId! > 0 && ['bukhansan', 'dobongsan'].includes(mountainKey);

  useEffect(() => {
    if (enabled) setEntered(true);
  }, [enabled]);

  useEffect(() => {
    if (!entered || !connected || courseId === undefined) return;
    const controller = new AbortController();
    void loadParkControl(courseId, mountainKey, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setState(previous => {
        if (previous.status !== 'success') return { status: 'success', data };
        const office = previous.data.office;
        const freshOffice = data.office;
        if (!office || !freshOffice || office.status !== freshOffice.status || office.sourceAsOf !== freshOffice.sourceAsOf) return previous;
        const assets = office.assets.map(asset => {
          const fresh = freshOffice.assets.find(item => item.kind === asset.kind && item.sourceUrl === asset.sourceUrl && item.name === asset.name);
          return { ...asset, imageUrl: fresh?.imageUrl ?? null };
        });
        return { status: 'success', data: { ...previous.data, office: { ...office, assets } } };
      });
    }).catch(() => {
      if (!controller.signal.aborted) setState(previous => previous.status === 'success' ? previous :
        { status: 'error', message: '통제정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' });
    });
    return () => controller.abort();
  }, [entered, connected, courseId, mountainKey, attempt]);

  function retry() {
    setState({ status: 'loading' });
    setAttempt(value => value + 1);
  }

  function renewImages() {
    if (renewed.current) return;
    renewed.current = true;
    setAttempt(value => value + 1);
  }

  return { state: connected ? state : { status: 'unavailable' } as const, expanded, setExpanded, retry, renewImages };
}
