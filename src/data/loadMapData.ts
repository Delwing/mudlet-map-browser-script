import {MapReader, type IMapReader} from "mudlet-map-renderer";
import {readerFromLoadedMap, type LoadedMudletMap} from "mudlet-map-renderer/binary";
import {SkeletonMapReader, buildSkeleton} from "mudlet-map-renderer/bigmap";
import {config} from "../config";
import MapLoadWorker from "./mapLoadWorker?worker&inline";
import type {LoadRequest, StreamMsg} from "./mapLoadWorker";

/** Below this many total rooms, matches the renderer's own `loadMudletMap` default. */
export const DEFAULT_BIG_MAP_THRESHOLD = 50_000;

/** Progress reported while a map source is being read into an `IMapReader`. */
export type LoadStatus =
    | {phase: "streaming"; rooms: number; total: number}
    | {phase: "finalizing"}
    | {phase: "building"};

/** The two values a plain (non-streamed) `MapReader`/`SkeletonMapReader` build needs. */
interface ParsedMapData {
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

/** Build the live reader from already-parsed map data, promoting big maps to a skeleton + LOD. */
export function readerFromParsed({mapData, colors}: ParsedMapData, threshold: number): IMapReader {
    let total = 0;
    for (const area of mapData) total += area.rooms.length;
    if (total > threshold) {
        return new SkeletonMapReader(buildSkeleton(mapData, colors));
    }
    return new MapReader(mapData, colors);
}

/**
 * Decode a Mudlet binary map (`.dat`) into a live reader, in-browser, off the
 * main thread. Below `threshold` total rooms this is a normal full parse (a
 * real `MapReader`, every field preserved); above it, the worker streams
 * room-by-room straight into a compact `SkeletonMapReader` so the full parsed
 * map is never resident in memory at once.
 */
async function loadFromDat(url: string, threshold: number, onStatus?: (status: LoadStatus) => void): Promise<IMapReader> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    const bytes = new Uint8Array(await res.arrayBuffer());

    const loaded = await new Promise<LoadedMudletMap>((resolve, reject) => {
        const worker = new MapLoadWorker();
        worker.onmessage = (event: MessageEvent<StreamMsg>) => {
            const msg = event.data;
            if (msg.type === "progress") {
                onStatus?.({phase: "streaming", rooms: msg.rooms, total: msg.total});
            } else if (msg.type === "finalizing") {
                onStatus?.({phase: "finalizing"});
            } else if (msg.type === "error") {
                worker.terminate();
                reject(new Error(msg.message));
            } else if (msg.type === "done") {
                worker.terminate();
                resolve(msg.loaded);
            }
        };
        worker.onerror = event => {
            worker.terminate();
            reject(new Error(event.message || "map load worker failed"));
        };
        worker.postMessage({bytes, mode: "auto", threshold} satisfies LoadRequest, [bytes.buffer]);
    });

    onStatus?.({phase: "building"});
    return readerFromLoadedMap(loaded);
}

/**
 * Resolve a live map reader from the configured source.
 *
 * Order: `mapUrl` (a `.dat` decoded in-browser via a Worker, or a combined
 * `.json`) → `mapDataUrl` + `colorsUrl` (two JSON arrays) → the legacy
 * `mapData` / `colors` globals (deprecated; kept so existing host pages keep
 * working). Maps above `config.bigMapThreshold` (default 50,000 rooms) render
 * from a viewport-virtualized `SkeletonMapReader` with LOD instead of a full
 * object graph — see `IMapReader`.
 */
export async function loadMapReader(onStatus?: (status: LoadStatus) => void): Promise<IMapReader> {
    const threshold = config.bigMapThreshold ?? DEFAULT_BIG_MAP_THRESHOLD;

    if (config.mapUrl) {
        return isJsonUrl(config.mapUrl)
            ? readerFromParsed(await fetchJson<ParsedMapData>(config.mapUrl), threshold)
            : loadFromDat(config.mapUrl, threshold, onStatus);
    }

    if (config.mapDataUrl && config.colorsUrl) {
        const [mapData, colors] = await Promise.all([
            fetchJson<MapData.Map>(config.mapDataUrl),
            fetchJson<MapData.Env[]>(config.colorsUrl),
        ]);
        return readerFromParsed({mapData, colors}, threshold);
    }

    if (typeof mapData !== "undefined" && typeof colors !== "undefined") {
        console.warn(
            "mudlet-map-browser: loading from the `mapData` / `colors` globals is deprecated; " +
                "set `window.MAP_CONFIG.mapUrl` to a .dat (or .json) instead.",
        );
        return readerFromParsed({mapData, colors}, threshold);
    }

    throw new Error(
        "mudlet-map-browser: no map source. Set `window.MAP_CONFIG.mapUrl` (a .dat or .json), " +
            "or `mapDataUrl` + `colorsUrl`.",
    );
}
