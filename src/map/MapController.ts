import {
    MapRenderer,
    createSettings as createRendererSettings,
    PathFinder,
    Sketchy,
    Parchment,
    Blueprint,
    Neon,
    Isometric,
    GradientRooms,
    compose,
    identityStyle,
    PngExporter,
    PngBlobExporter,
    SvgExporter,
    CanvasExporter,
} from "mudlet-map-renderer";
import {isHashLookupCapable} from "mudlet-map-renderer";
import type {
    IMapReader,
    Style,
    Settings,
    RoomClickEventDetail,
    RoomContextMenuEventDetail,
    AreaExitClickEventDetail,
    ZoomChangeEventDetail,
} from "mudlet-map-renderer";
import {Emitter} from "./emitter";
import {Preview} from "../preview";
import {downloadNpc, type RoomNpcMap} from "../data/npc";
import {downloadVersion} from "../versions";
import {config} from "../config";
import {readerFromParsed, DEFAULT_BIG_MAP_THRESHOLD} from "../data/loadMapData";

const rainbow = ["#CC99C9", "#9EC1CF", "#9EE09E", "#FDFD97", "#FEB144", "#FF6663"];
let pathPick = 0;

/** Neutral default line color, overriding the renderer's green-tinted rgb(225, 255, 225). */
const DEFAULT_LINE_COLOR = "#e1e1e1";

/** Renderer settings with this project's neutral default line color applied. */
function createSettings(): Settings {
    const settings = createRendererSettings();
    settings.lineColor = DEFAULT_LINE_COLOR;
    // Three-tier LOD (vector -> rooms-only -> raster) kicks in only once a
    // plane's room count/zoom crosses its budget, so this is a no-op for
    // ordinary maps and only matters for big (skeleton-backed) ones.
    settings.lodEnabled = true;
    return settings;
}

export interface PageSettings {
    preview: boolean;
    keepZoomLevel: boolean;
    disableKeyBinds: boolean;
    isoRotation: number;
    userBackgroundColor?: string;
    userLineColor?: string;
}

export interface PathEntry {
    key: string;
    from: string;
    to: string;
    color: string;
    locations: number[];
}

export interface AreaOption {
    id: number;
    name: string;
}

export interface LevelsState {
    levels: number[];
    current: number;
}

export interface AreaExitInfo {
    fromId: number;
    targetId: number;
    targetAreaName: string;
}

export interface AreaInfo {
    name: string;
    id: number;
    roomCount: number;
    exits: AreaExitInfo[];
}

export interface ToastMessage {
    id: number;
    text: string;
}

interface ControllerEvents extends Record<string, unknown> {
    selected: MapData.Room | null;
    levels: LevelsState;
    paths: PathEntry[];
    version: string | null;
    toast: ToastMessage;
    zoom: ZoomChangeEventDetail;
    area: number;
    npc: RoomNpcMap;
    areas: AreaOption[];
}

export interface MapControllerOptions {
    /** Translation lookup. May be swapped at runtime when the language changes. */
    t: (key: string) => string;
}

export class MapController {
    private readonly emitter = new Emitter<ControllerEvents>();
    on = this.emitter.on.bind(this.emitter);

    map: HTMLDivElement;
    reader: IMapReader;
    renderer!: MapRenderer;
    pathFinder: PathFinder;
    settings: Settings;
    pageSettings: PageSettings;
    preview: Preview;
    t: (key: string) => string;

    areaId = 0;
    zIndex = 0;
    zoom = 1;
    selectedRoom: MapData.Room | null = null;
    paths: Record<string, PathEntry> = {};
    renderMode = "normal";
    roomNpc: RoomNpcMap = {};
    versionTag: string | null = null;
    levelsSnapshot: LevelsState = {levels: [], current: 0};

    private progressTimeout: ReturnType<typeof setTimeout> | undefined;
    private suppressSettingsApply = false;

    constructor(map: HTMLDivElement, reader: IMapReader, options: MapControllerOptions) {
        this.map = map;
        this.reader = reader;
        this.t = options.t;
        this.settings = createSettings();
        this.settings.areaExitLabels = true;
        this.pathFinder = new PathFinder(this.reader);

        this.pageSettings = {
            preview: true,
            keepZoomLevel: false,
            disableKeyBinds: false,
            isoRotation: 30,
        };

        this.loadStoredSettings();

        const storedPosition = localStorage.getItem("position");
        let position: {area: number; zIndex: number} | null = null;
        if (storedPosition) {
            position = JSON.parse(storedPosition);
        }
        this.storedPosition = position;

        this.map.addEventListener("roomclick", ((event: CustomEvent<RoomClickEventDetail>) => {
            const room = this.reader.getRoom(event.detail.roomId);
            if (room) {
                this.selectRoom(room);
            }
        }) as EventListener);

        this.map.addEventListener("zoom", ((event: CustomEvent<ZoomChangeEventDetail>) => {
            this.zoom = event.detail.zoom;
            this.emitter.emit("zoom", event.detail);
            this.preview.update();
        }) as EventListener);

        this.map.addEventListener("mapclick", () => {
            this.deselectRoom();
        });

        this.map.addEventListener("roomcontextmenu", ((event: CustomEvent<RoomContextMenuEventDetail>) => {
            this.renderer.centerOn(event.detail.roomId);
        }) as EventListener);

        this.map.addEventListener("areaexitclick", ((event: CustomEvent<AreaExitClickEventDetail>) => {
            setTimeout(() => {
                if (event.detail.targetRoomId) {
                    this.findRoom(event.detail.targetRoomId);
                }
            });
        }) as EventListener);

        this.preview = new Preview(this.map, this);
        this.renderer = new MapRenderer(this.reader, this.settings, this.map);

        downloadNpc()
            .then(value => {
                this.roomNpc = value;
                this.emitter.emit("npc", value);
            })
            .catch(() => {});
    }

    private storedPosition: {area: number; zIndex: number} | null = null;

    private loadStoredSettings() {
        const loaded = localStorage.getItem("settings");
        if (!loaded) return;
        const parsed = JSON.parse(loaded);
        // Migrate old field names
        if (parsed.mapBackground !== undefined && parsed.backgroundColor === undefined) {
            parsed.backgroundColor = parsed.mapBackground;
        }
        if (parsed.linesColor !== undefined && parsed.lineColor === undefined) {
            parsed.lineColor = parsed.linesColor;
        }
        if (parsed.exitsSize !== undefined && parsed.lineWidth === undefined) {
            parsed.lineWidth = parsed.exitsSize;
        }
        // Coerce numeric settings that may have been stored as strings
        if (typeof parsed.roomSize === "string") parsed.roomSize = parseFloat(parsed.roomSize);
        if (typeof parsed.lineWidth === "string") parsed.lineWidth = parseFloat(parsed.lineWidth);
        if (parsed.isRound !== undefined && parsed.roomShape === undefined) {
            parsed.roomShape = parsed.isRound ? "circle" : "rectangle";
        }
        // Scale old integer roomSize values to new float scale
        if (parsed.roomSize !== undefined && parsed.roomSize > 5) {
            parsed.roomSize = parsed.roomSize / 25;
        }
        if (parsed.lineWidth !== undefined && parsed.lineWidth > 1) {
            parsed.lineWidth = parsed.lineWidth / 100;
        }
        // Remove obsolete fields before applying
        delete parsed.mapBackground;
        delete parsed.linesColor;
        delete parsed.exitsSize;
        delete parsed.isRound;
        delete parsed.optimizeDrag;
        delete parsed.showLabels;
        delete parsed.gridColor;
        delete parsed.gridLineWidth;
        delete parsed.areaName;

        const defaults = createSettings();
        for (const key of Object.keys(defaults)) {
            if (parsed[key] !== undefined) {
                (this.settings as any)[key] = parsed[key];
            }
        }
        if (parsed.preview !== undefined) this.pageSettings.preview = parsed.preview;
        if (parsed.keepZoomLevel !== undefined) this.pageSettings.keepZoomLevel = parsed.keepZoomLevel;
        if (parsed.disableKeyBinds !== undefined) this.pageSettings.disableKeyBinds = parsed.disableKeyBinds;
        if (parsed.isoRotation !== undefined) this.pageSettings.isoRotation = parseFloat(parsed.isoRotation);
        if (parsed.userBackgroundColor !== undefined) this.pageSettings.userBackgroundColor = parsed.userBackgroundColor;
        if (parsed.userLineColor !== undefined) this.pageSettings.userLineColor = parsed.userLineColor;
        if (parsed.renderMode !== undefined) this.renderMode = parsed.renderMode;
    }

    // --- passthrough helpers for components ---
    getRoom(id: number) {
        return this.reader.getRoom(id);
    }
    getArea(id: number) {
        return this.reader.getArea(id);
    }
    getColorValue(env: number) {
        return this.reader.getColorValue(env);
    }
    getZoom() {
        return this.renderer.getZoom();
    }
    getRoomNpc(roomId: number): string[] {
        return this.roomNpc[roomId] || [];
    }

    getEffectiveBackground(): string {
        return this.renderMode === "pencil" ? "#ffffff" : this.settings.backgroundColor;
    }

    applyBackground() {
        const bg = this.getEffectiveBackground();
        this.map.style.backgroundColor = bg;
        for (const child of Array.from(this.map.children) as HTMLElement[]) {
            child.style.backgroundColor = bg;
        }
    }

    private applyModeColorOverrides(mode: string) {
        switch (mode) {
            case "pencil":
                this.settings.backgroundColor = "#ffffff";
                break;
            case "parchment":
            case "parchment-pencil":
            case "isometric-parchment":
                this.settings.backgroundColor = "#f4e4c1";
                this.settings.lineColor = "#5c4033";
                this.settings.fontFamily = "Georgia, serif";
                break;
            case "blueprint":
                this.settings.backgroundColor = "#0a1628";
                this.settings.lineColor = "#4a7ab5";
                this.settings.fontFamily = '"Courier New", monospace';
                break;
            case "neon":
                this.settings.backgroundColor = "#0a0a0f";
                this.settings.lineColor = "#00ffaa";
                break;
        }
    }

    applyRenderMode(mode: string) {
        if (this.pageSettings.userBackgroundColor === undefined) {
            this.pageSettings.userBackgroundColor = this.settings.backgroundColor;
        }
        if (this.pageSettings.userLineColor === undefined) {
            this.pageSettings.userLineColor = this.settings.lineColor;
        }

        this.renderMode = mode;

        this.settings.backgroundColor = this.pageSettings.userBackgroundColor;
        this.settings.lineColor = this.pageSettings.userLineColor;
        this.settings.fontFamily = createSettings().fontFamily;

        const jitter = this.settings.lineWidth * 0.6;
        const rotation = this.pageSettings.isoRotation;
        let style: Style = identityStyle;

        switch (mode) {
            case "pencil":
                style = Sketchy({jitter, color: "#444444"});
                break;
            case "parchment":
                style = Parchment;
                break;
            case "parchment-pencil":
                // Order matters: Sketchy whitens fills, so Parchment must run
                // last to recolour them into the parchment palette.
                style = compose(Sketchy({jitter, color: "#4a3728"}), Parchment);
                break;
            case "isometric": {
                const depth = this.settings.roomSize * 0.3;
                style = Isometric({depth, rotation});
                break;
            }
            case "isometric-parchment": {
                const depth = this.settings.roomSize * 0.3;
                // Iso must run first (it only extrudes rect/circle into cubes),
                // then Sketchy wobbles the cube faces, then Parchment recolours.
                style = compose(Isometric({depth, rotation}), Sketchy({jitter, color: "#4a3728"}), Parchment);
                break;
            }
            case "blueprint":
                style = Blueprint;
                break;
            case "neon":
                style = Neon;
                break;
            case "gradient":
                style = GradientRooms();
                break;
        }

        this.applyModeColorOverrides(mode);

        this.renderer.setStyle(style);
        this.renderer.updateBackground();
        this.renderer.refresh();
        this.applyBackground();
    }

    /** Whether the iso-rotation control should be visible. */
    isIsometric(): boolean {
        return this.renderMode.startsWith("isometric");
    }

    init() {
        if (this.renderMode !== "normal") {
            this.applyRenderMode(this.renderMode);
        }

        const urlSearchParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlSearchParams.entries());
        const url = window.location.origin + window.location.pathname;

        if (params.version) {
            this.replaceVersion(params.version);
            history.replaceState(null, "", url);
            return;
        }

        let area = this.reader.getAreas()[0].getAreaId();
        let zIdx = 0;
        if (params.loc) {
            this.findRoom(parseInt(params.loc));
            history.replaceState(null, "", url);
        } else if (params.hash) {
            this.findRoomByHash(params.hash);
            history.replaceState(null, "", url);
        } else {
            if (params.area) {
                area = parseInt(params.area);
                history.replaceState(null, "", url);
            } else if (this.storedPosition !== null && this.storedPosition.area) {
                area = this.storedPosition.area;
                zIdx = this.storedPosition.zIndex;
            }
            this.renderArea(area, zIdx);
        }
    }

    applySettings(formData: Record<string, any>) {
        if (this.suppressSettingsApply) return;
        // Handle merged label render mode (data-transparent → data + transparentLabels)
        if (formData.labelRenderMode === "data-transparent") {
            formData.labelRenderMode = "data";
            formData.transparentLabels = true;
        } else if (formData.labelRenderMode !== undefined) {
            formData.transparentLabels = false;
        }

        const defaults = createSettings();
        for (const key of Object.keys(defaults)) {
            if (formData[key] !== undefined) {
                (this.settings as any)[key] = formData[key];
            }
        }
        if (formData.backgroundColor !== undefined) this.pageSettings.userBackgroundColor = formData.backgroundColor;
        if (formData.lineColor !== undefined) this.pageSettings.userLineColor = formData.lineColor;
        if (formData.preview !== undefined) this.pageSettings.preview = formData.preview;
        if (formData.keepZoomLevel !== undefined) this.pageSettings.keepZoomLevel = formData.keepZoomLevel;
        if (formData.disableKeyBinds !== undefined) this.pageSettings.disableKeyBinds = formData.disableKeyBinds;
        if (formData.isoRotation !== undefined) this.pageSettings.isoRotation = formData.isoRotation;

        if (formData.roomStyle !== undefined) {
            this.settings.frameMode = formData.roomStyle === "frame";
            this.settings.coloredMode = formData.roomStyle === "colored";
        }

        const isoRotationChanged = formData.isoRotation !== undefined && this.renderMode.startsWith("isometric");
        if ((formData.renderMode !== undefined && formData.renderMode !== this.renderMode) || isoRotationChanged) {
            this.applyRenderMode(formData.renderMode ?? this.renderMode);
        } else {
            this.applyModeColorOverrides(this.renderMode);
            this.renderer.updateBackground();
            this.applyBackground();
            this.renderer.refresh();
        }

        this.scheduleRefreshPreview();
        this.saveSettings();
    }

    /** Snapshot used to populate the settings form (mirrors the old populateSettingsInner). */
    getSettingsSnapshot(): Record<string, any> {
        const allSettings: Record<string, any> = {...this.settings, ...this.pageSettings, renderMode: this.renderMode};
        if (allSettings.labelRenderMode === "data" && allSettings.transparentLabels) {
            allSettings.labelRenderMode = "data-transparent";
        }
        allSettings.roomStyle = this.settings.frameMode ? "frame" : this.settings.coloredMode ? "colored" : "normal";
        if (this.pageSettings.userBackgroundColor) allSettings.backgroundColor = this.pageSettings.userBackgroundColor;
        if (this.pageSettings.userLineColor) allSettings.lineColor = this.pageSettings.userLineColor;
        return allSettings;
    }

    getDefaultSettings(): Record<string, any> {
        const defaults = createSettings();
        defaults.areaExitLabels = true;
        return {
            ...defaults,
            preview: true,
            keepZoomLevel: false,
            disableKeyBinds: false,
            renderMode: "normal",
        };
    }

    resetSettings() {
        this.applySettings(this.getDefaultSettings());
    }

    private refreshPreviewTimeout: ReturnType<typeof setTimeout> | undefined;

    private scheduleRefreshPreview() {
        if (!this.pageSettings.preview) return;
        if (this.refreshPreviewTimeout !== undefined) clearTimeout(this.refreshPreviewTimeout);
        this.refreshPreviewTimeout = setTimeout(() => {
            this.refreshPreviewTimeout = undefined;
            this.refreshPreview();
        }, 200);
    }

    private refreshPreview() {
        if (!this.pageSettings.preview) return;
        const bounds = this.renderer.getAreaBounds();
        if (!bounds) return;
        const areaW = bounds.maxX - bounds.minX;
        const areaH = bounds.maxY - bounds.minY;
        if (areaW <= 0 || areaH <= 0) return;

        const padding = 3;
        const paddedW = areaW + 2 * padding;
        const paddedH = areaH + 2 * padding;
        const MAX = 400;
        const aspect = paddedW / paddedH;
        const width = aspect >= 1 ? MAX : Math.round(MAX * aspect);
        const height = aspect >= 1 ? Math.round(MAX / aspect) : MAX;
        const canvas = this.renderer.export(new CanvasExporter({width, height, padding}));
        if (!canvas) return;

        this.preview.init(
            {
                minX: bounds.minX - padding,
                maxX: bounds.maxX + padding,
                minY: bounds.minY - padding,
                maxY: bounds.maxY + padding,
            },
            canvas.toDataURL("image/png"),
        );
    }

    private readMapInsets(): {top: number; right: number; bottom: number; left: number} {
        const probe = document.createElement("div");
        probe.style.cssText =
            "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;" +
            "padding-top:var(--map-top-inset,0px);" +
            "padding-right:var(--map-right-inset,0px);" +
            "padding-bottom:var(--map-bottom-inset,0px);" +
            "padding-left:var(--map-left-inset,0px);";
        document.body.appendChild(probe);
        const computed = getComputedStyle(probe);
        const insets = {
            top: parseFloat(computed.paddingTop) || 0,
            right: parseFloat(computed.paddingRight) || 0,
            bottom: parseFloat(computed.paddingBottom) || 0,
            left: parseFloat(computed.paddingLeft) || 0,
        };
        probe.remove();
        return insets;
    }

    saveSettings() {
        localStorage.setItem(
            "settings",
            JSON.stringify({
                ...this.settings,
                ...this.pageSettings,
                renderMode: this.renderMode,
            }),
        );
    }

    renderArea(areaId: number, zIndex: number, force?: boolean): boolean {
        if (this.areaId !== areaId || this.zIndex !== zIndex || force) {
            this.areaId = areaId;
            this.zIndex = zIndex;

            localStorage.setItem("position", JSON.stringify({area: areaId, zIndex: zIndex}));
            this.renderer.updateBackground();
            this.applyBackground();
            this.renderer.drawArea(areaId, zIndex);
            this.renderer.fitArea(this.readMapInsets());

            const area = this.reader.getArea(areaId);
            this.emitter.emit("area", areaId);
            if (area) {
                this.emitLevels(area.getZLevels(), zIndex);
            }
            this.hideRoomInfo();

            this.reRenderAllPaths();

            this.renderer.clearHighlights();
            if (this.pageSettings.keepZoomLevel && this.zoom) {
                this.renderer.zoomToCenter(this.zoom);
            }

            this.refreshPreview();
            return true;
        }
        return false;
    }

    private emitLevels(levels: number[], current: number) {
        const sorted = levels.slice().sort((a, b) => a - b);
        this.levelsSnapshot = {levels: sorted, current};
        this.emitter.emit("levels", this.levelsSnapshot);
    }

    getLevels(): LevelsState {
        return this.levelsSnapshot;
    }

    getPaths(): PathEntry[] {
        return Object.values(this.paths);
    }

    selectArea(areaId: number) {
        this.renderArea(areaId, 0);
    }

    selectLevel(zIndex: number) {
        this.renderArea(this.areaId, zIndex);
    }

    getAreas(): AreaOption[] {
        return this.reader
            .getAreas()
            .filter(
                // getZLevels() works from area-level data on every IArea implementation;
                // getRooms() is deliberately always [] on a SkeletonMapReader's IArea (it
                // never materialises the full room list), so it can't be used as an
                // "area has rooms" check here.
                area => area.getZLevels().length > 0 && area.getAreaName() !== undefined && area.getAreaName() !== "",
            )
            .sort((a, b) => {
                const nameA = a.getAreaName().toLowerCase();
                const nameB = b.getAreaName().toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            })
            .map(area => ({id: area.getAreaId(), name: area.getAreaName()}));
    }

    getAreaInfo(areaId: number): AreaInfo | null {
        const area = this.reader.getArea(areaId);
        if (!area) return null;
        const rooms = area.getRooms();
        const exits: AreaExitInfo[] = rooms
            .flatMap(room => this.getAreaExits(room))
            .map(([fromId, targetId]) => {
                const targetArea = this.reader.getArea(this.reader.getRoom(targetId)?.area ?? 0);
                return {fromId, targetId, targetAreaName: targetArea?.getAreaName() ?? "?"};
            });
        return {name: area.getAreaName(), id: area.getAreaId(), roomCount: rooms.length, exits};
    }

    private getAreaExits(room: MapData.Room): [number, number][] {
        const areaExits: [number, number][] = [];
        Object.values(room.exits)
            .filter(target => this.isExitTarget(target))
            .forEach(exitId => areaExits.push([room.id, exitId]));
        Object.values(room.specialExits)
            .filter(target => this.isExitTarget(target))
            .forEach(exitId => areaExits.push([room.id, exitId]));
        return areaExits;
    }

    private isExitTarget(destinationRoom: number): boolean {
        const destRoom = this.reader.getRoom(destinationRoom);
        if (!destRoom) return false;
        const currentArea = this.renderer.getCurrentArea();
        return destRoom.area !== currentArea?.getAreaId();
    }

    findRoom(id: number) {
        if (!id) return;
        const room = this.reader.getRoom(id);
        if (room) {
            const areaChanged = this.renderArea(room.area, room.z);
            this.renderer.setZoom(0.5);
            this.renderer.centerOn(id, areaChanged);
            this.selectRoom(room);
        } else {
            this.showToast(this.t("location-not-found"));
        }
    }

    findRoomByHash(hash: string) {
        if (!hash) return;
        // getRooms() is always [] on a SkeletonMapReader (never materialises the
        // full room list — see IMapReader docs), so a linear scan can't find
        // anything on a big/streamed map. Prefer the reader's own hash index
        // when it has one; fall back to the scan for readers that don't.
        const roomId = isHashLookupCapable(this.reader)
            ? this.reader.getRoomIdByHash(hash)
            : this.reader.getRooms().find(r => r.hash === hash)?.id;
        if (roomId !== undefined) {
            this.findRoom(roomId);
        } else {
            this.showToast(this.t("location-not-found"));
        }
    }

    findRooms(rooms: (string | number)[]) {
        const firstRoom = this.reader.getRoom(parseInt(String(rooms[0])));
        if (firstRoom) {
            const areaChanged = this.renderArea(firstRoom.area, firstRoom.z);
            this.renderer.setZoom(0.5);
            this.renderer.centerOn(firstRoom.id, areaChanged);
            this.selectRoom(firstRoom);
            if (rooms.length > 1) {
                rooms.slice(1).forEach(roomId => {
                    this.renderer.renderHighlight(parseInt(String(roomId)), "#FFFF00");
                });
            }
        } else {
            this.showToast(this.t("location-not-found"));
        }
    }

    findPath(from: string, to: string): boolean {
        const key = `${from}#${to}`;
        const existingColor = this.paths[key]?.color;
        const pathColor = existingColor ?? rainbow[pathPick++ % rainbow.length];

        const pathLocations = this.pathFinder.findPath(parseInt(from), parseInt(to));
        if (!pathLocations) {
            this.showToast(this.t("no-path"));
            pathPick--;
            return false;
        }

        this.paths[key] = {key, from, to, color: pathColor, locations: pathLocations};
        this.reRenderAllPaths();
        this.emitPaths();
        return true;
    }

    setPathColor(key: string, color: string) {
        if (this.paths[key]) {
            this.paths[key].color = color;
            this.reRenderAllPaths();
            this.emitPaths();
        }
    }

    removePath(key: string) {
        delete this.paths[key];
        this.reRenderAllPaths();
        this.emitPaths();
    }

    private emitPaths() {
        this.emitter.emit("paths", Object.values(this.paths));
    }

    private reRenderAllPaths() {
        this.renderer.clearPaths();
        Object.values(this.paths).forEach(pathData => {
            this.renderer.renderPath(pathData.locations, pathData.color);
        });
    }

    zoomBy(factor: number) {
        this.renderer.zoomToCenter(this.renderer.getZoom() * factor);
    }

    selectRoom(room: MapData.Room) {
        this.renderer.clearHighlights();
        this.selectedRoom = room;
        this.renderer.updatePositionMarker(room.id);
        this.emitter.emit("selected", room);
    }

    deselectRoom() {
        this.selectedRoom = null;
        this.renderer.clearHighlights();
        this.renderer.clearPosition();
        this.emitter.emit("selected", null);
    }

    private hideRoomInfo() {
        this.selectedRoom = null;
        this.emitter.emit("selected", null);
    }

    goDirection(directionKey: string) {
        const fullDirection = dirsShortToLong(directionKey);
        if (this.selectedRoom && this.selectedRoom.exits[fullDirection as MapData.direction]) {
            this.findRoom(this.selectedRoom.exits[fullDirection as MapData.direction]);
        }
    }

    showToast(text: string) {
        this.emitter.emit("toast", {id: Date.now() + Math.floor(Math.random() * 1000), text});
    }

    saveImage() {
        const pngUrl = this.renderer.export(new PngExporter());
        if (!pngUrl) return;
        const a = document.createElement("a");
        a.setAttribute("href", pngUrl);
        a.setAttribute("download", (this.renderer.getCurrentArea()?.getAreaName() ?? "map") + ".png");
        document.body.append(a);
        a.click();
        a.remove();
    }

    downloadImage() {
        const svg = this.renderer.export(new SvgExporter());
        if (!svg) return;
        const a = document.createElement("a");
        a.setAttribute("href", svgToDataURL(svg));
        a.setAttribute("download", (this.renderer.getCurrentArea()?.getAreaName() ?? "map") + ".svg");
        document.body.append(a);
        a.click();
        a.remove();
    }

    copyImage() {
        if (typeof ClipboardItem !== "undefined") {
            const blobPromise = this.renderer.export(new PngBlobExporter());
            if (blobPromise) {
                blobPromise.then((blob: Blob) => navigator.clipboard.write([new ClipboardItem({"image/png": blob})]));
            }
            this.showToast(this.t("copied"));
        } else {
            this.showToast(this.t("no-clipboard"));
        }
    }

    replaceVersion(tag: string) {
        if (!config.versionsFilesUrl) return;
        downloadVersion(tag, config.versionsFilesUrl).then(data => {
            const threshold = config.bigMapThreshold ?? DEFAULT_BIG_MAP_THRESHOLD;
            this.reader = readerFromParsed({mapData: data as MapData.Map, colors}, threshold);
            this.pathFinder = new PathFinder(this.reader);
            this.renderer = new MapRenderer(this.reader, this.settings, this.map);
            if (this.renderMode !== "normal") this.applyRenderMode(this.renderMode);
            this.emitter.emit("areas", this.getAreas());
            this.renderArea(this.areaId, this.zIndex, true);
            this.showToast(`Przeladowano wersje na ${tag}`);
            this.versionTag = tag;
            this.emitter.emit("version", tag);
        });
    }
}

function svgToDataURL(svgStr: string): string {
    const encoded = encodeURIComponent(svgStr).replace(/'/g, "%27").replace(/"/g, "%22");
    return "data:image/svg+xml," + encoded;
}

const dirs: Record<string, string> = {
    north: "n",
    south: "s",
    east: "e",
    west: "w",
    northeast: "ne",
    northwest: "nw",
    southeast: "se",
    southwest: "sw",
    up: "u",
    down: "d",
};

function dirsShortToLong(dir: string): string {
    for (const k in dirs) {
        if (dirs[k] === dir) return k;
    }
    return dir;
}
