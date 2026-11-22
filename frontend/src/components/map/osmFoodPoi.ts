import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";

export type OsmFoodPoi = {
  id: string;
  name: string;
  kind: "restaurant" | "cafe";
  coordinate: [longitude: number, latitude: number];
};

type TileDecoder = (buffer: ArrayBuffer, x: number, y: number, zoom: number) => readonly OsmFoodPoi[];

type PoiLayer = { id: string; type?: string; source?: string; "source-layer"?: string };
type PoiFeature = {
  id?: string | number;
  properties?: Record<string, unknown> | null;
  geometry?: unknown;
};

const RESTAURANT_TYPES = new Set(["restaurant", "fast_food", "food_court"]);

export function foodPoiLayerIds(layers: readonly PoiLayer[] | undefined): string[] {
  return (layers ?? [])
    .filter(layer => layer.type === "symbol" && layer["source-layer"] === "poi")
    .map(layer => layer.id);
}

export function foodPoiSources(layers: readonly PoiLayer[] | undefined) {
  const sources = new Map<string, { source: string; sourceLayer: string }>();
  (layers ?? []).forEach(layer => {
    if (layer.type !== "symbol" || typeof layer.source !== "string" || layer["source-layer"] !== "poi") return;
    sources.set(`${layer.source}/poi`, { source: layer.source, sourceLayer: "poi" });
  });
  return [...sources.values()];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function toOsmFoodPoi(feature: PoiFeature, fallback: [number, number]): OsmFoodPoi | null {
  const properties = feature.properties ?? {};
  const category = text(properties.subclass) || text(properties.class);
  const kind = category === "cafe" ? "cafe" : RESTAURANT_TYPES.has(category) ? "restaurant" : null;
  const name = text(properties["name:nonlatin"]) || text(properties.name) || text(properties.name_en);
  if (!kind || !name) return null;

  const geometry = feature.geometry && typeof feature.geometry === "object"
    ? feature.geometry as { type?: unknown; coordinates?: unknown } : null;
  const raw = geometry?.type === "Point" ? geometry.coordinates : null;
  const coordinate: [number, number] = Array.isArray(raw) && raw.length >= 2
    && Number.isFinite(raw[0]) && Number.isFinite(raw[1])
    ? [Number(raw[0]), Number(raw[1])] : fallback;
  const sourceId = feature.id ?? properties.osm_id ?? properties.id
    ?? `${coordinate[0].toFixed(6)}-${coordinate[1].toFixed(6)}-${name}`;
  return { id: `osm-poi-${String(sourceId)}`, name, kind, coordinate };
}

function distanceSquared(origin: [number, number], coordinate: [number, number]) {
  const latitudeScale = Math.cos((origin[1] + coordinate[1]) * Math.PI / 360);
  return ((coordinate[0] - origin[0]) * latitudeScale) ** 2 + (coordinate[1] - origin[1]) ** 2;
}

function closestPois(pois: readonly OsmFoodPoi[], origin: [number, number], limit: number) {
  const unique = new Map<string, OsmFoodPoi>();
  pois.forEach(poi => { if (!unique.has(poi.id)) unique.set(poi.id, poi); });
  return [...unique.values()]
    .sort((left, right) => distanceSquared(origin, left.coordinate) - distanceSquared(origin, right.coordinate))
    .slice(0, Math.max(0, limit));
}

export function nearestOsmFoodPois(features: readonly PoiFeature[], origin: [number, number], limit = 8) {
  return closestPois(features.map(feature => toOsmFoodPoi(feature, origin))
    .filter((poi): poi is OsmFoodPoi => poi !== null), origin, limit);
}

function decodeOsmFoodTile(buffer: ArrayBuffer, x: number, y: number, zoom: number) {
  const layer = new VectorTile(new PbfReader(buffer)).layers.poi;
  if (!layer) return [];
  const pois: OsmFoodPoi[] = [];
  for (let index = 0; index < layer.length; index += 1) {
    const feature = layer.feature(index);
    const geoJson = feature.toGeoJSON(x, y, zoom);
    const poi = toOsmFoodPoi({ id: feature.id, properties: feature.properties, geometry: geoJson.geometry }, [0, 0]);
    if (poi) pois.push(poi);
  }
  return pois;
}

function tileCoordinate([longitude, latitude]: [number, number], zoom: number) {
  const count = 2 ** zoom;
  const x = Math.floor((longitude + 180) / 360 * count);
  const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = boundedLatitude * Math.PI / 180;
  const y = Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * count);
  return { x, y };
}

export async function fetchOsmFoodPois(origin: [number, number], signal?: AbortSignal,
  fetcher: typeof fetch = fetch, decoder: TileDecoder = decodeOsmFoodTile) {
  const tileJsonResponse = await fetcher("https://tiles.openfreemap.org/planet", { signal });
  if (!tileJsonResponse.ok) throw new Error("OSM 타일 정보를 조회하지 못했어요.");
  const tileJson = await tileJsonResponse.json() as { tiles?: unknown };
  const template = Array.isArray(tileJson.tiles) && typeof tileJson.tiles[0] === "string" ? tileJson.tiles[0] : null;
  if (!template) throw new Error("OSM 타일 주소를 확인하지 못했어요.");

  const zoom = 14;
  const center = tileCoordinate(origin, zoom);
  const tilePois = await Promise.all([-1, 0, 1].flatMap(deltaX => [-1, 0, 1].map(async deltaY => {
    const x = center.x + deltaX;
    const y = center.y + deltaY;
    const url = template.replace("{z}", String(zoom)).replace("{x}", String(x)).replace("{y}", String(y));
    const response = await fetcher(url, { signal });
    if (!response.ok) return [];
    return decoder(await response.arrayBuffer(), x, y, zoom);
  })));
  return closestPois(tilePois.flat(), origin, 8);
}
