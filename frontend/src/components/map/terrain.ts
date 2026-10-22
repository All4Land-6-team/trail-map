import type {
  HillshadeLayerSpecification,
  MapLibreMap,
  RasterDEMSourceSpecification,
} from "maplibre-gl";
import type { TerrainSource } from "../../api/terrain";
import type { MapDimension } from "./MapAction";

export type TerrainStatus = "idle" | "loading" | "ready" | "error";

export const TERRAIN_SOURCE_ID = "bukhansan-terrain-dem";
export const HILLSHADE_SOURCE_ID = "bukhansan-hillshade-dem";
export const HILLSHADE_LAYER_ID = "bukhansan-hillshade";
export const TERRAIN_MOUNTAIN_ID = "bukhansan";

type TerrainLayerMap = Pick<MapLibreMap, "addLayer" | "addSource" | "getLayer" | "getSource">;
type TerrainModeMap = Pick<MapLibreMap, "easeTo" | "getSource" | "setTerrain">;

export function installTerrainLayers(
  map: TerrainLayerMap,
  source: TerrainSource,
  beforeLayerId?: string,
) {
  if (!map.getSource(TERRAIN_SOURCE_ID)) {
    map.addSource(TERRAIN_SOURCE_ID, cloneSource(source));
  }
  if (!map.getSource(HILLSHADE_SOURCE_ID)) {
    map.addSource(HILLSHADE_SOURCE_ID, cloneSource(source));
  }
  if (!map.getLayer(HILLSHADE_LAYER_ID)) {
    const layer: HillshadeLayerSpecification = {
      id: HILLSHADE_LAYER_ID,
      type: "hillshade",
      source: HILLSHADE_SOURCE_ID,
      paint: {
        "hillshade-exaggeration": 0.35,
        "hillshade-shadow-color": "#294d3f",
        "hillshade-highlight-color": "#f4f8ed",
        "hillshade-accent-color": "#668777",
      },
    };
    map.addLayer(layer, beforeLayerId);
  }
}

export function removeTerrainLayers(map: TerrainLayerMap & Pick<MapLibreMap, "removeLayer" | "removeSource" | "setTerrain">) {
  map.setTerrain(null);
  if (map.getLayer(HILLSHADE_LAYER_ID)) map.removeLayer(HILLSHADE_LAYER_ID);
  if (map.getSource(HILLSHADE_SOURCE_ID)) map.removeSource(HILLSHADE_SOURCE_ID);
  if (map.getSource(TERRAIN_SOURCE_ID)) map.removeSource(TERRAIN_SOURCE_ID);
}

export function supportsTerrain(mountainId?: string) {
  return mountainId === TERRAIN_MOUNTAIN_ID;
}

export function isTerrainSourceError(event: unknown) {
  if (typeof event !== "object" || event === null || !("sourceId" in event)) return false;
  const sourceId = event.sourceId;
  return sourceId === TERRAIN_SOURCE_ID || sourceId === HILLSHADE_SOURCE_ID;
}

export function applyTerrainMode(map: TerrainModeMap, mode: MapDimension) {
  if (!map.getSource(TERRAIN_SOURCE_ID)) return false;
  map.setTerrain(mode === "3D"
    ? { source: TERRAIN_SOURCE_ID, exaggeration: 1 }
    : null);
  map.easeTo({ pitch: mode === "3D" ? 50 : 0, duration: 350 });
  return true;
}

function cloneSource(source: TerrainSource | RasterDEMSourceSpecification): RasterDEMSourceSpecification {
  return {
    ...source,
    tiles: source.tiles ? [...source.tiles] : undefined,
    bounds: source.bounds ? [...source.bounds] : undefined,
  };
}
