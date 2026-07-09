import {parseMudletMap} from "mudlet-map-renderer/binary";
import type {LoadedMudletMap, LoadMode} from "mudlet-map-renderer/binary";

// Runs mudlet-map-renderer's parseMudletMap() off the main thread: it peeks
// the .dat header for the total room count, then either streams straight
// into a MapSkeleton (huge maps — see LoadMudletMapOptions.threshold) or
// does a normal full parse (small maps). Bundled inline (see the `?worker&inline`
// import in loadMapData.ts) so the published bundle stays a single JS file.
//
// Typed against a minimal hand-rolled worker-scope shape rather than the
// `webworker` lib — this project's tsconfig only pulls in `DOM`, and the two
// libs declare conflicting globals (`self`, `postMessage`, ...) if mixed.

export interface LoadRequest {
    bytes: Uint8Array;
    mode: LoadMode;
    threshold: number;
}

export type StreamProgress = {type: "progress"; rooms: number; total: number};
export type StreamFinalizing = {type: "finalizing"};
export type StreamError = {type: "error"; message: string};
export type StreamDone = {type: "done"; loaded: LoadedMudletMap};
export type StreamMsg = StreamProgress | StreamFinalizing | StreamError | StreamDone;

interface WorkerScope {
    onmessage: ((event: {data: LoadRequest}) => void) | null;
    postMessage: (message: StreamMsg, transfer?: Transferable[]) => void;
}

const ctx = self as unknown as WorkerScope;

ctx.onmessage = event => {
    try {
        const {bytes, mode, threshold} = event.data;
        const loaded = parseMudletMap(bytes, {
            mode,
            threshold,
            onProgress: (rooms, total) => ctx.postMessage({type: "progress", rooms, total}),
        });
        // Rooms are all parsed at this point — what's left is handing the result
        // to the main thread. For a huge streamed map the browser's own
        // structured-clone of the skeleton's non-transferred fields (names,
        // userData, detail rooms, labels) can itself take a real moment, with no
        // JS hook inside that gap. Send this cheap marker first so there's no
        // silent pause with no explanation.
        ctx.postMessage({type: "finalizing"});
        const transfer: Transferable[] =
            loaded.kind === "skeleton"
                ? [
                      loaded.skeleton.x.buffer,
                      loaded.skeleton.y.buffer,
                      loaded.skeleton.z.buffer,
                      loaded.skeleton.area.buffer,
                      loaded.skeleton.env.buffer,
                      loaded.skeleton.id.buffer,
                      loaded.skeleton.exits.buffer,
                  ]
                : [];
        ctx.postMessage({type: "done", loaded}, transfer);
    } catch (err) {
        ctx.postMessage({
            type: "error",
            message: err instanceof Error ? `${err.message}\n${err.stack}` : String(err),
        });
    }
};
