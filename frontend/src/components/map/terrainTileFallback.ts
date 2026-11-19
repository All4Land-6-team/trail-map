import {
  addProtocol,
  type RequestTransformFunction,
} from "maplibre-gl";

const PROTOCOL = "terrain-dem";
const PROTOCOL_PREFIX = `${PROTOCOL}://`;
const TERRAIN_TILE_URL = /terrain[^?#]*\/\d+\/\d+\/\d+\.png(?:[?#]|$)/;
const SEA_LEVEL_RGB = "rgb(1, 134, 160)";

type TerrainTileDependencies = {
  fetcher?: typeof fetch;
  createFlatTile?: () => Promise<ArrayBuffer>;
};

let registered = false;
let flatTile: Promise<ArrayBuffer> | null = null;

export function isTerrainTileUrl(url: string) {
  return TERRAIN_TILE_URL.test(url);
}

export const transformTerrainTileRequest: RequestTransformFunction = (url, resourceType) => ({
  url: resourceType === "Tile"
    && isTerrainTileUrl(url)
    && !url.startsWith(PROTOCOL_PREFIX)
    ? `${PROTOCOL_PREFIX}${url}`
    : url,
});

export async function isMissingTerrainTileResponse(response: Response) {
  if (response.status !== 400 && response.status !== 404) return false;

  const body = await response.clone().json().catch(() => null);
  if (!isRecord(body)) return false;

  if (response.status === 400) {
    return body.statusCode === "404"
      && body.error === "not_found"
      && body.code === "NoSuchKey";
  }

  return body.code === "TERRAIN_404_1" && body.httpStatus === 404;
}

export async function requestTerrainTile(
  url: string,
  signal: AbortSignal,
  {
    fetcher = fetch,
    createFlatTile = flatDemTile,
  }: TerrainTileDependencies = {},
) {
  const response = await fetcher(url, { signal });
  if (response.ok) return response.arrayBuffer();
  if (await isMissingTerrainTileResponse(response)) return createFlatTile();

  throw new Error(`Terrain 타일 조회에 실패했습니다. (${response.status})`);
}

export function registerTerrainTileFallbackProtocol() {
  if (registered) return;
  addProtocol(PROTOCOL, async (params, abortController) => ({
    data: await requestTerrainTile(
      params.url.slice(PROTOCOL_PREFIX.length),
      abortController.signal,
    ),
  }));
  registered = true;
}

function flatDemTile(): Promise<ArrayBuffer> {
  flatTile ??= (async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("빈 지형 타일을 만들지 못했어요");
    context.fillStyle = SEA_LEVEL_RGB;
    context.fillRect(0, 0, 256, 256);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(result => result
        ? resolve(result)
        : reject(new Error("빈 지형 타일을 만들지 못했어요")), "image/png"));
    return blob.arrayBuffer();
  })();
  return flatTile;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
