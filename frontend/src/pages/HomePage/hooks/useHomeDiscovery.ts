import { useCallback, useEffect, useRef, useState } from "react";
import { loadHomeDiscoveryData } from "../../../api/homeMock";
import {
  HOME_TIME_ZONE, HOME_TOAST_DURATION_MS, RECENT_MOUNTAIN_LIMIT, RECENT_MOUNTAIN_STORAGE_KEY,
} from "../../../constants/home";
import type { HomeDiscoveryState } from "../../../types/home";
import { addRecentMountain, findMountainByQuery, findTodaySchedule, normalizeMountainQuery, readRecentMountainIds, toHomeDateKey } from "../../../utils/homeDiscovery";

export function useHomeDiscovery() {
  const [state, setState] = useState<HomeDiscoveryState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [selectedMountainId, setSelectedMountainId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const toastId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    loadHomeDiscoveryData(controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      let raw: string | null = null;
      try { raw = window.localStorage.getItem(RECENT_MOUNTAIN_STORAGE_KEY); } catch { /* 저장이 막혀도 탐색은 계속한다. */ }
      setRecentIds(readRecentMountainIds(
        raw, new Set(data.mountains.map((mountain) => mountain.id)),
        data.initialRecentMountainIds, RECENT_MOUNTAIN_LIMIT,
      ));
      setState({ status: "success", data });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: "error" });
    });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (state.status !== "success") return;
    try { window.localStorage.setItem(RECENT_MOUNTAIN_STORAGE_KEY, JSON.stringify(recentIds)); } catch { /* 메모리 상태를 사용한다. */ }
  }, [recentIds, state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), HOME_TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((message: string) => {
    setToast({ id: ++toastId.current, message });
  }, []);
  const closeSearch = useCallback(() => { setIsSearching(false); setQuery(""); }, []);
  const resetHome = useCallback(() => {
    setSelectedMountainId(null);
    setIsSearching(false);
    setQuery("");
    setToast(null);
  }, []);

  const data = state.status === "success" ? state.data : null;
  const mountains = data?.mountains ?? [];
  const byIds = (ids: readonly string[]) => ids.flatMap((id) => {
    const mountain = mountains.find((item) => item.id === id);
    return mountain ? [mountain] : [];
  });

  function selectMountain(mountainId: string) {
    const mountain = mountains.find((item) => item.id === mountainId);
    if (!mountain) return undefined;
    setSelectedMountainId(mountainId);
    setRecentIds((previous) => addRecentMountain(previous, mountainId, RECENT_MOUNTAIN_LIMIT));
    closeSearch();
    setToast(null);
    return mountain;
  }

  function searchMountain() {
    if (!normalizeMountainQuery(query)) {
      notify("산 이름을 입력해 주세요.");
      return undefined;
    }
    const mountain = findMountainByQuery(mountains, query);
    if (!mountain) {
      notify("검색 결과가 없어요.");
      return undefined;
    }
    return selectMountain(mountain.id);
  }

  return {
    state, mountains, selectedMountainId, isSearching, query, toast, notify,
    recentMountains: byIds(recentIds),
    recommendedMountains: byIds(data?.recommendedMountainIds ?? []),
    todaySchedule: findTodaySchedule(data?.schedules ?? [], toHomeDateKey(new Date(), HOME_TIME_ZONE)),
    setQuery, openSearch: () => setIsSearching(true), closeSearch, resetHome,
    selectMountain, searchMountain, retry: () => {
      setState({ status: "loading" });
      setAttempt((value) => value + 1);
    },
  };
}
