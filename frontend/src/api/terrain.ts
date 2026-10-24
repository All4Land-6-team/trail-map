export type TerrainSource = {
  type: "raster-dem";
  tiles: string[];
  minzoom: number;
  maxzoom: number;
  bounds: [west: number, south: number, east: number, north: number];
  tileSize: number;
  encoding: "mapbox";
};

const DEFAULT_API_BASE_URL = "http://localhost:8080";
const DEFAULT_TIMEOUT_MS = 8_000;
let terrainSourceRequest: Promise<TerrainSource> | null = null;

export function terrainSourceUrl(
  apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
) {
  return `${apiBaseUrl.replace(/\/+$/, "")}/api/v1/terrain/source`;
}

export function parseTerrainSource(value: unknown): TerrainSource {
  if (!isRecord(value)
    || value.type !== "raster-dem"
    || value.encoding !== "mapbox"
    || !Array.isArray(value.tiles)
    || value.tiles.length === 0
    || !value.tiles.every(tile => typeof tile === "string" && tile.length > 0)
    || !isZoom(value.minzoom)
    || !isZoom(value.maxzoom)
    || value.minzoom > value.maxzoom
    || !isPositiveInteger(value.tileSize)
    || !isBounds(value.bounds)) {
    throw new Error("Terrain source 응답 형식이 올바르지 않습니다.");
  }

  return {
    type: value.type,
    tiles: [...value.tiles],
    minzoom: value.minzoom,
    maxzoom: value.maxzoom,
    bounds: [...value.bounds],
    tileSize: value.tileSize,
    encoding: value.encoding,
  };
}

export function loadTerrainSource({
  forceRefresh = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  forceRefresh?: boolean;
  timeoutMs?: number;
} = {}): Promise<TerrainSource> {
  if (forceRefresh) terrainSourceRequest = null;
  if (terrainSourceRequest) return terrainSourceRequest;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const request = fetch(terrainSourceUrl(), {
    headers: { Accept: "application/json" },
    signal: controller.signal,
  }).then(async response => {
      if (!response.ok) {
        throw new Error(`Terrain source 조회에 실패했습니다. (${response.status})`);
      }
      return parseTerrainSource(await response.json());
    })
    .catch(error => {
      if (terrainSourceRequest === request) terrainSourceRequest = null;
      throw error;
    })
    .finally(() => clearTimeout(timeout));
  terrainSourceRequest = request;
  return terrainSourceRequest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isZoom(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 0
    && value <= 22;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isBounds(value: unknown): value is TerrainSource["bounds"] {
  return Array.isArray(value)
    && value.length === 4
    && value.every(coordinate => typeof coordinate === "number" && Number.isFinite(coordinate))
    && value[0] < value[2]
    && value[1] < value[3];
}
