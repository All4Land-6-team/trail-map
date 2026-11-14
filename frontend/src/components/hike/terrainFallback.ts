import { addProtocol, type MapLibreMap } from "maplibre-gl";

// 3D 지형 타일 보완: 지형 설명의 범위(bounds) 안에도 DEM이 없어 올라가지 않은 타일이 있다(받으면 400).
// BaseMap은 지형 타일이 하나라도 실패하면 지형 전체를 끄므로, 등산 지도에서는 지형 타일 요청을 가로채
// 없는 타일을 높이 0인 평평한 타일로 대신 채운다. 빈 타일은 DEM 범위 밖 가장자리라 지형 모양에는 영향이 없다.

const PROTOCOL = "hike-dem";
/** 지형 DEM 타일 주소 (Supabase 저장소 terrain-public, 백엔드 /api/v1/terrain/{z}/{x}/{y}.png) */
const TERRAIN_TILE_URL = /terrain[^?#]*\/\d+\/\d+\/\d+\.png(?:[?#]|$)/;
/** mapbox 인코딩에서 높이 0m인 색: -10000 + (R·65536 + G·256 + B)·0.1 = 0 */
const SEA_LEVEL_RGB = "rgb(1, 134, 160)";

let registered = false;
let flatTile: Promise<ArrayBuffer> | null = null;

export function isTerrainTileUrl(url: string) {
  return TERRAIN_TILE_URL.test(url);
}

/** 높이 0으로 채운 256px DEM 타일 PNG */
function flatDemTile(): Promise<ArrayBuffer> {
  flatTile ??= (async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d")!;
    context.fillStyle = SEA_LEVEL_RGB;
    context.fillRect(0, 0, 256, 256);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(result => result ? resolve(result) : reject(new Error("빈 지형 타일을 만들지 못했어요")), "image/png"));
    return blob.arrayBuffer();
  })();
  return flatTile;
}

function registerProtocol() {
  if (registered) return;
  registered = true;
  addProtocol(PROTOCOL, async (params, abortController) => {
    const url = params.url.slice(`${PROTOCOL}://`.length);
    try {
      const response = await fetch(url, { signal: abortController.signal });
      if (response.ok) return { data: await response.arrayBuffer() };
    } catch (error) {
      // 지도를 옮겨 요청이 취소된 경우는 그대로 취소로 둔다. 네트워크 오류는 평평한 타일로 채운다.
      if (abortController.signal.aborted) throw error;
    }
    return { data: await flatDemTile() };
  });
}

/** 이 지도의 지형 타일 요청을 보완 프로토콜로 보낸다. 지형 타일을 요청하기 전(지도 생성 직후)에 부른다. */
export function installTerrainFallback(map: Pick<MapLibreMap, "setTransformRequest">) {
  registerProtocol();
  map.setTransformRequest((url, resourceType) =>
    resourceType === "Tile" && isTerrainTileUrl(url) && !url.startsWith(`${PROTOCOL}://`) ? { url: `${PROTOCOL}://${url}` } : { url });
}
