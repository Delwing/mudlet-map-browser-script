import {MudletMapReader} from "mudlet-map-binary-reader";
import {config} from "../config";

/** The two values the renderer's `MapReader` constructor consumes. */
export interface RendererData {
    mapData: MapData.Map;
    colors: MapData.Env[];
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
}

/** A combined export file (`{ mapData, colors }`) is JSON; a binary map is `.dat`. */
function isJsonUrl(url: string): boolean {
    return new URL(url, location.href).pathname.toLowerCase().endsWith(".json");
}

/** Decode a Mudlet binary map (`.dat`) into renderer data, in-browser. */
async function loadFromDat(url: string): Promise<RendererData> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const map = MudletMapReader.readBuffer(bytes);
    // The reader and renderer declare structurally-equivalent but independently-typed
    // shapes (e.g. Room.areaId is filled in by the renderer), so bridge at the boundary.
    return MudletMapReader.export(map) as unknown as RendererData;
}

/**
 * Resolve the renderer's `{ mapData, colors }` from the configured source.
 *
 * Order: `mapUrl` (a `.dat` decoded in-browser, or a combined `.json`) →
 * `mapDataUrl` + `colorsUrl` (two JSON arrays) → the legacy `mapData` / `colors`
 * globals (deprecated; kept so existing host pages keep working).
 */
export async function loadMapData(): Promise<RendererData> {
    if (config.mapUrl) {
        return isJsonUrl(config.mapUrl)
            ? fetchJson<RendererData>(config.mapUrl)
            : loadFromDat(config.mapUrl);
    }

    if (config.mapDataUrl && config.colorsUrl) {
        const [mapData, colors] = await Promise.all([
            fetchJson<MapData.Map>(config.mapDataUrl),
            fetchJson<MapData.Env[]>(config.colorsUrl),
        ]);
        return {mapData, colors};
    }

    if (typeof mapData !== "undefined" && typeof colors !== "undefined") {
        console.warn(
            "mudlet-map-browser: loading from the `mapData` / `colors` globals is deprecated; " +
                "set `window.MAP_CONFIG.mapUrl` to a .dat (or .json) instead.",
        );
        return {mapData, colors};
    }

    throw new Error(
        "mudlet-map-browser: no map source. Set `window.MAP_CONFIG.mapUrl` (a .dat or .json), " +
            "or `mapDataUrl` + `colorsUrl`.",
    );
}
