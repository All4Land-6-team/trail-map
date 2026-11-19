import { descendHikeRecord, finishHikeRecord, HIKE_RECORD_ERROR, HikeRecordApiError, isHikeNetworkError } from "../api/hikeRecordApi";
import { flushHikePositions } from "../hooks/useHikeTracking";
import { applyFinishedHikeRecord } from "./hikeSessionStore";

// 통신이 끊긴 동안 누른 「하산 시작」·「등산 종료」를 휴대폰에 쌓아 두었다가, 다시 연결되면
// 모아 둔 위치 → 하산 시작 → 등산 종료 순서로 서버에 보낸다. 화면은 누른 즉시 바뀌어 있다.

const KEY = "trail-map.hike-pending-actions";
const RETRY_MS = 30_000;

export type PendingHikeActions = {
  hikeRecordId: number;
  descend?: boolean;
  /** 기기에서 등산 종료를 누른 시각 (ISO) */
  finishedAt?: string;
};

function read(): PendingHikeActions[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value as PendingHikeActions[] : [];
  } catch {
    return [];
  }
}

function write(items: PendingHikeActions[]) {
  try {
    if (items.length) window.localStorage.setItem(KEY, JSON.stringify(items));
    else window.localStorage.removeItem(KEY);
  } catch { /* 저장하지 못하면 이 화면이 켜져 있는 동안만 다시 보낸다. */ }
}

export function pendingHikeActions(hikeRecordId?: number) {
  const items = read();
  return hikeRecordId === undefined ? items : items.filter(item => item.hikeRecordId === hikeRecordId);
}

/** 서버에 보내지 못한 동작을 쌓는다. 같은 기록의 동작은 한 항목에 합친다. */
export function queueHikeAction(hikeRecordId: number, action: { descend: true } | { finishedAt: string }) {
  const items = read();
  const current = items.find(item => item.hikeRecordId === hikeRecordId);
  if (current) Object.assign(current, action);
  else items.push({ hikeRecordId, ...action });
  write(items);
  scheduleRetry();
}

/** 다시 보내도 받아 주지 않는 실패(없는 기록, 다른 사용자, 이미 종료)면 그 동작은 끝난 것으로 본다. */
function isDone(error: unknown) {
  return error instanceof HikeRecordApiError
    && (error.code === HIKE_RECORD_ERROR.recordAlreadyCompleted || error.status === 404 || error.status === 403);
}

let syncing: Promise<void> | null = null;

/** 쌓인 동작을 순서대로 보낸다. 통신이 아직 안 되면 남겨 두고 다음에 다시 시도한다. */
export function syncPendingHikeActions(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    for (const item of read()) {
      try {
        await flushHikePositions(item.hikeRecordId);
        if (item.descend && !item.finishedAt) {
          await descendHikeRecord(item.hikeRecordId).catch(error => { if (!isDone(error)) throw error; });
        }
        if (item.finishedAt) {
          const record = await finishHikeRecord(item.hikeRecordId, item.finishedAt).catch(error => {
            if (isDone(error)) return null;
            throw error;
          });
          if (record) applyFinishedHikeRecord(record);
        }
        write(read().filter(other => other.hikeRecordId !== item.hikeRecordId));
      } catch (error) {
        // 서버가 거절한 동작(4xx)은 다시 보내도 같으므로 버린다. 통신 끊김·서버 오류는 남겨 두고 다음에 다시 보낸다.
        // 로그인 만료(401)는 다시 로그인하면 같은 요청이 성공하므로 남겨 둔다 (위치 대기열과 같은 기준).
        if (isHikeNetworkError(error) || !(error instanceof HikeRecordApiError) || error.status >= 500 || error.status === 401) break;
        write(read().filter(other => other.hikeRecordId !== item.hikeRecordId));
      }
    }
  })().finally(() => {
    syncing = null;
    if (read().length) scheduleRetry();
  });
  return syncing;
}

let retryTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRetry() {
  if (retryTimer !== undefined || typeof window === "undefined") return;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    void syncPendingHikeActions();
  }, RETRY_MS);
}

let started = false;
/** 앱이 켜질 때 한 번: 남은 동작을 보내고, 통신이 다시 연결되면 바로 보낸다. */
export function startHikeOfflineSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => { void syncPendingHikeActions(); });
  if (read().length) void syncPendingHikeActions();
}
