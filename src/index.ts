import Translator from "@andreasremdt/simple-translator";
import {Modal, Toast} from "bootstrap";
import {MapReader, MapRenderer, createSettings, PathFinder, KonvaBackend, SketchyBackend, ParchmentBackend, BlueprintBackend, NeonBackend, IsometricBackend} from "mudlet-map-renderer";
import type {DrawingBackend} from "mudlet-map-renderer";
import type {Settings, RoomClickEventDetail, RoomContextMenuEventDetail, AreaExitClickEventDetail, ZoomChangeEventDetail} from "mudlet-map-renderer";
import {Preview} from "./preview";
import {downloadTags, downloadVersion} from "./versions";

const rainbow = ["#CC99C9", "#9EC1CF", "#9EE09E", "#FDFD97", "#FEB144", "#FF6663"];
let pathPick = 0;

const defaultLanguage = document.querySelector("html")!.getAttribute("lang") ?? "pl";

const translator = new Translator({
    defaultLanguage: defaultLanguage,
    detectLanguage: false,
    selector: "[data-i18n]",
    debug: false,
    registerGlobally: "__",
    persist: true,
    persistKey: "preferred_language",
    filesLocation: "i18n",
});
(window as any).translator = translator;

if (location.hostname !== "") {
    translator
        .fetch([defaultLanguage], false)
        .then((json: any) => {
            const defaultLang: Record<string, string> = {};
            document.querySelectorAll("[data-i18n]").forEach(item => {
                defaultLang[item.getAttribute("data-i18n")!] = item.innerHTML;
            });
            translator.add(defaultLanguage, {...defaultLang, ...json});
        })
        .catch((e: Error) => console.log(`Cannot fetch translations. ${e.message}`));

    translator
        .fetch(["en"])
        .then(() => {
            translator.translatePageTo();
        })
        .catch((e: Error) => console.log(`Cannot fetch translations. ${e.message}`));
} else if (typeof translations !== "undefined") {
    const defaultLang: Record<string, string> = {};
    document.querySelectorAll("[data-i18n]").forEach(item => {
        defaultLang[item.getAttribute("data-i18n")!] = item.innerHTML;
    });
    translator.add("pl", {...defaultLang, ...translations.pl});
    translator.add("en", translations.en);
}

const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());
const url = window.location.origin + window.location.pathname;

const svgToDataURL = (svgStr: string): string => {
    const encoded = encodeURIComponent(svgStr).replace(/'/g, "%27").replace(/"/g, "%22");
    return "data:image/svg+xml," + encoded;
};

function toHexColor(color: string): string {
    if (color.startsWith("#")) return color;
    const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, "0");
        const g = parseInt(match[2]).toString(16).padStart(2, "0");
        const b = parseInt(match[3]).toString(16).padStart(2, "0");
        return `#${r}${g}${b}`;
    }
    return color;
}

import {downloadNpc, findNpc} from "./npc";
let roomNpc: Record<number, string[]> = {};
downloadNpc().then(value => (roomNpc = value));

let position: {area: number; zIndex: number} | null = null;
const storedPosition = localStorage.getItem("position");
if (storedPosition) {
    position = JSON.parse(storedPosition);
}

interface PageSettings {
    preview: boolean;
    keepZoomLevel: boolean;
    disableKeyBinds: boolean;
    isoRotation: number;
    userBackgroundColor?: string;
    userLineColor?: string;
}

interface PathData {
    locations: number[];
    color: string;
}

class PageControls {
    map: HTMLDivElement;
    reader: MapReader;
    renderer: MapRenderer;
    pathFinder: PathFinder;
    settings: Settings;
    pageSettings: PageSettings;
    select: HTMLSelectElement;
    infoBox: HTMLElement;
    levels: HTMLElement;
    saveImageButton: HTMLElement | null;
    saveSvgImageButton: HTMLElement | null;
    copyImageButton: HTMLElement | null;
    zoomButtons: NodeListOf<HTMLElement>;
    toastContainer: HTMLElement;
    searchModal: HTMLElement;
    search: HTMLFormElement;
    findPathForm: HTMLFormElement | null;
    findPathModal: HTMLElement | null;
    helpModal: HTMLElement;
    zoomBar: HTMLElement;
    settingsModal: HTMLElement;
    settingsForm: HTMLFormElement;
    resetSettingsButton: HTMLElement;
    versions: HTMLSelectElement | null;
    releaseDescription: HTMLElement;
    versionBadge: HTMLElement;
    languageSelector: HTMLElement;
    currentLanguageFlag: HTMLElement;
    pathBox: HTMLElement;
    areaModal: HTMLElement | null;
    preview: Preview;
    areaId: number = 0;
    zIndex: number = 0;
    zoom: number = 1;
    selectedRoom: MapData.Room | null = null;
    paths: Record<string, PathData> = {};
    progressTimeout: ReturnType<typeof setTimeout> | undefined;
    renderMode: string = "normal";

    constructor(reader: MapReader) {
        this.map = document.querySelector("#map") as HTMLDivElement;
        this.reader = reader;
        this.settings = createSettings();
        this.pathFinder = new PathFinder(this.reader);

        this.pageSettings = {
            preview: true,
            keepZoomLevel: false,
            disableKeyBinds: false,
            isoRotation: 30,
        };

        const loaded = localStorage.getItem("settings");
        if (loaded) {
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
            // Remove old grid defaults so new ones take effect
            delete parsed.gridColor;
            delete parsed.gridLineWidth;
            // Reset areaName to pick up new default (true)
            delete parsed.areaName;

            // Apply renderer settings
            const defaults = createSettings();
            for (const key of Object.keys(defaults)) {
                if (parsed[key] !== undefined) {
                    (this.settings as any)[key] = parsed[key];
                }
            }
            // Apply page settings
            if (parsed.preview !== undefined) this.pageSettings.preview = parsed.preview;
            if (parsed.keepZoomLevel !== undefined) this.pageSettings.keepZoomLevel = parsed.keepZoomLevel;
            if (parsed.disableKeyBinds !== undefined) this.pageSettings.disableKeyBinds = parsed.disableKeyBinds;
            if (parsed.isoRotation !== undefined) this.pageSettings.isoRotation = parseFloat(parsed.isoRotation);
            if (parsed.userBackgroundColor !== undefined) this.pageSettings.userBackgroundColor = parsed.userBackgroundColor;
            if (parsed.userLineColor !== undefined) this.pageSettings.userLineColor = parsed.userLineColor;
            if (parsed.renderMode !== undefined) this.renderMode = parsed.renderMode;
        }

        this.map.addEventListener("roomclick", ((event: CustomEvent<RoomClickEventDetail>) => {
            const room = this.reader.getRoom(event.detail.roomId);
            if (room) {
                this.selectRoom(room);
            }
        }) as EventListener);

        this.map.addEventListener("zoom", ((event: CustomEvent<ZoomChangeEventDetail>) => {
            this.adjustZoomBar(event.detail);
            this.zoom = event.detail.zoom;
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

        this.select = document.querySelector("#area") as HTMLSelectElement;
        this.infoBox = document.querySelector(".info-box")!;
        this.levels = document.querySelector(".levels")!;
        this.saveImageButton = document.querySelector(".save-image");
        this.saveSvgImageButton = document.querySelector(".save-image-svg");
        this.copyImageButton = document.querySelector(".copy-image");
        this.zoomButtons = document.querySelectorAll(".zoom-controls .btn");
        this.toastContainer = document.querySelector(".toast")!;
        this.searchModal = document.querySelector("#search")!;
        this.search = document.querySelector(".search-form") as HTMLFormElement;
        this.findPathForm = document.querySelector(".findpath-form") as HTMLFormElement | null;
        this.findPathModal = document.querySelector("#findpath");
        this.helpModal = document.querySelector("#help")!;
        this.zoomBar = document.querySelector(".progress-container")!;
        this.settingsModal = document.querySelector("#settings")!;
        this.settingsForm = document.querySelector("[data-settings-form]") as HTMLFormElement;
        this.resetSettingsButton = document.querySelector("#settings button[type='reset']")!;
        this.versions = document.querySelector("#versions") as HTMLSelectElement | null;
        this.releaseDescription = document.querySelector(".release-description")!;
        this.versionBadge = document.querySelector(".version-number")!;
        this.languageSelector = document.querySelector(".lang-dropdown")!;
        this.currentLanguageFlag = document.querySelector(".current-language-flag")!;
        this.pathBox = document.querySelector(".path-box ul")!;
        this.areaModal = document.getElementById("area-info");
        this.preview = new Preview(this.map, this);

        if (this.versions) {
            this.versions.addEventListener("change", event => {
                const target = event.target as HTMLSelectElement;
                this.replaceVersion(target.value);
                this.releaseDescription.innerHTML = target.selectedOptions[0].getAttribute("data-description") ?? "";
                Modal.getInstance(this.helpModal)?.hide();
            });

            this.helpModal.addEventListener("shown.bs.modal", () => {
                if (this.versions!.children.length == 0) {
                    (downloadTags(this.versions!.getAttribute("data-tags")!) as Promise<any[]>).then((tags) => {
                        tags.forEach((tag: any) => {
                            const option = document.createElement("option");
                            option.setAttribute("value", tag.tag_name);
                            option.setAttribute("data-description", (tag.body ?? "").replaceAll("\n\n", "\n"));
                            option.innerHTML = tag.tag_name;
                            this.versions!.append(option);
                        });
                        this.releaseDescription.innerHTML = this.versions!.firstElementChild?.getAttribute("data-description") ?? "";
                    });
                }
            });
        }

        this.saveImageButton?.addEventListener("click", () => this.saveImage());
        this.saveSvgImageButton?.addEventListener("click", event => {
            event.preventDefault();
            this.downloadImage();
        });
        this.copyImageButton?.addEventListener("click", () => this.copyImage());

        this.zoomButtons.forEach(item =>
            item.addEventListener("click", event => {
                const delta = parseFloat((event.currentTarget as HTMLElement).getAttribute("data-factor")!);
                this.renderer.zoomToCenter(this.renderer.getZoom() * delta);
            })
        );

        this.search.addEventListener("submit", event => {
            event.preventDefault();
            this.submitSearch();
        });

        this.findPathForm?.addEventListener("submit", event => {
            event.preventDefault();
            this.submitPathFind();
        });

        this.findPathModal?.addEventListener("shown.bs.modal", () => {
            (this.findPathModal!.querySelector("input") as HTMLInputElement)?.focus();
        });

        this.searchModal.addEventListener("shown.bs.modal", () => {
            this.searchModal.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
        });

        this.searchModal.addEventListener("hidden.bs.modal", () => {
            const input = this.searchModal.querySelector<HTMLInputElement>("[data-search-input]");
            if (input && input.value) {
                input.value = "";
                input.dispatchEvent(new Event("input", {bubbles: true}));
            }
        });

        this.settingsModal.addEventListener("show.bs.modal", () => {
            this.populateSettings();
            const isoGroup = document.querySelector<HTMLElement>("[data-iso-rotation-group]");
            if (isoGroup) isoGroup.style.display = this.renderMode.startsWith("isometric") ? "" : "none";
        });

        this.settingsModal.addEventListener("shown.bs.modal", () => {
            (this.settingsModal.querySelector("input") as HTMLInputElement)?.focus();
        });

        this.settingsForm.addEventListener("submit", event => {
            event.preventDefault();
        });

        let applyScheduled = false;
        const scheduleApply = () => {
            if (applyScheduled || this.suppressSettingsApply) return;
            applyScheduled = true;
            requestAnimationFrame(() => {
                applyScheduled = false;
                this.applyCurrentSettings();
            });
        };
        this.settingsForm.addEventListener("input", scheduleApply);
        this.settingsForm.addEventListener("change", scheduleApply);

        this.resetSettingsButton?.addEventListener("click", event => {
            event.preventDefault();
            this.resetSettings();
        });

        this.settingsModal.querySelectorAll<HTMLButtonElement>(".color-reset").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetId = btn.getAttribute("data-target");
                if (!targetId) return;
                const input = this.settingsModal.querySelector<HTMLInputElement>(`#${targetId}`);
                if (!input) return;
                input.value = input.defaultValue;
                input.dispatchEvent(new Event("change", {bubbles: true}));
            });
        });

        document.querySelectorAll<HTMLButtonElement>("[data-clear-input]").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetId = btn.getAttribute("data-clear-input");
                if (!targetId) return;
                const input = document.getElementById(targetId) as HTMLInputElement | null;
                if (!input) return;
                input.value = "";
                input.dispatchEvent(new Event("input", {bubbles: true}));
                input.focus();
            });
        });

        this.areaModal?.addEventListener("show.bs.modal", () => {
            this.populateAreaInfo(this.areaId);
        });

        this.translatePage();
        this.languageSelector.querySelectorAll("a").forEach(element => {
            element.addEventListener("click", event => {
                event.preventDefault();
                this.translatePage((element as HTMLElement).getAttribute("data-lang") ?? undefined);
            });
        });

        this.renderer = new MapRenderer(this.reader, this.settings, this.map);
    }

    getEffectiveBackground(): string {
        return this.renderMode === "pencil" ? '#ffffff' : this.settings.backgroundColor;
    }

    applyBackground() {
        const bg = this.getEffectiveBackground();
        this.map.style.backgroundColor = bg;
        // Also override any child divs the renderer may have created
        for (const child of Array.from(this.map.children) as HTMLElement[]) {
            child.style.backgroundColor = bg;
        }
    }

    applyRenderMode(mode: string) {
        // First time: capture current colors as user's preference if not already saved
        if (this.pageSettings.userBackgroundColor === undefined) {
            this.pageSettings.userBackgroundColor = this.settings.backgroundColor;
        }
        if (this.pageSettings.userLineColor === undefined) {
            this.pageSettings.userLineColor = this.settings.lineColor;
        }

        this.renderMode = mode;

        // Restore user's preferences before applying new mode (so we don't accumulate overrides)
        this.settings.backgroundColor = this.pageSettings.userBackgroundColor;
        this.settings.lineColor = this.pageSettings.userLineColor;
        this.settings.fontFamily = createSettings().fontFamily;

        const jitter = this.settings.lineWidth * 0.6;
        const rotation = this.pageSettings.isoRotation;
        type BackendFactory = (inner: DrawingBackend) => DrawingBackend;
        let factory: BackendFactory = (inner) => inner;

        switch (mode) {
            case "pencil":
                factory = (inner) => new SketchyBackend(inner, jitter, '#444444');
                this.settings.backgroundColor = '#ffffff';
                break;
            case "parchment":
                factory = (inner) => new ParchmentBackend(inner);
                this.settings.backgroundColor = '#f4e4c1';
                this.settings.lineColor = '#5c4033';
                this.settings.fontFamily = 'Georgia, serif';
                break;
            case "parchment-pencil": {
                const pencilColor = '#4a3728';
                factory = (inner) => new SketchyBackend(new ParchmentBackend(inner), jitter, pencilColor);
                this.settings.backgroundColor = '#f4e4c1';
                this.settings.lineColor = '#5c4033';
                this.settings.fontFamily = 'Georgia, serif';
                break;
            }
            case "isometric": {
                const depth = this.settings.roomSize * 0.3;
                factory = (inner) => new IsometricBackend(inner, {depth, rotation});
                break;
            }
            case "isometric-parchment": {
                const depth = this.settings.roomSize * 0.3;
                const pencilColor = '#4a3728';
                factory = (inner) => new IsometricBackend(
                    new SketchyBackend(new ParchmentBackend(inner), jitter, pencilColor),
                    {depth, rotation},
                );
                this.settings.backgroundColor = '#f4e4c1';
                this.settings.lineColor = '#5c4033';
                this.settings.fontFamily = 'Georgia, serif';
                break;
            }
            case "blueprint":
                factory = (inner) => new BlueprintBackend(inner);
                this.settings.backgroundColor = '#0a1628';
                this.settings.lineColor = '#4a7ab5';
                this.settings.fontFamily = '"Courier New", monospace';
                break;
            case "neon":
                factory = (inner) => new NeonBackend(inner);
                this.settings.backgroundColor = '#0a0a0f';
                this.settings.lineColor = '#00ffaa';
                break;
        }

        this.renderer.setDrawingBackend(factory(new KonvaBackend()));
        this.renderer.setDrawingBackendFactory(factory);

        this.renderer.updateBackground();
        this.renderer.refresh();
        this.applyBackground();

        // Show/hide iso rotation control
        const isoGroup = document.querySelector<HTMLElement>("[data-iso-rotation-group]");
        if (isoGroup) isoGroup.style.display = mode.startsWith("isometric") ? "" : "none";
    }


    init() {
        // Apply saved render mode after renderer is ready
        if (this.renderMode !== "normal") {
            this.applyRenderMode(this.renderMode);
        }

        if (params.version && this.versions) {
            this.replaceVersion(params.version);
            history.replaceState(null, "", url);
            return;
        }

        let area = this.reader.getAreas()[0].getAreaId();
        let zIdx = 0;
        if (params.loc) {
            this.findRoom(parseInt(params.loc));
            history.replaceState(null, "", url);
        } else {
            if (params.area) {
                area = parseInt(params.area);
                history.replaceState(null, "", url);
            } else if (position !== null && position.area) {
                area = position.area;
                zIdx = position.zIndex;
            }
            this.renderArea(area, zIdx);
        }
    }

    applyCurrentSettings() {
        const formData: Record<string, any> = {};

        this.settingsForm.querySelectorAll<HTMLInputElement>("input[name]").forEach(element => {
            const name = element.getAttribute("name");
            if (!name) return;
            const type = element.getAttribute("type");
            if (type === "checkbox") {
                formData[name] = element.checked;
            } else if (type === "number" || type === "range") {
                formData[name] = parseFloat(element.value);
            } else {
                formData[name] = element.value;
            }
        });

        this.settingsForm.querySelectorAll<HTMLSelectElement>("select[name]").forEach(element => {
            const name = element.getAttribute("name");
            if (name) formData[name] = element.value;
        });

        // Handle merged label render mode (data-transparent → data + transparentLabels)
        if (formData.labelRenderMode === "data-transparent") {
            formData.labelRenderMode = "data";
            formData.transparentLabels = true;
        } else if (formData.labelRenderMode !== undefined) {
            formData.transparentLabels = false;
        }

        // Apply renderer settings (only known keys)
        const defaults = createSettings();
        for (const key of Object.keys(defaults)) {
            if (formData[key] !== undefined) {
                (this.settings as any)[key] = formData[key];
            }
        }
        // Track user's color preferences (so they survive mode switches)
        if (formData.backgroundColor !== undefined) this.pageSettings.userBackgroundColor = formData.backgroundColor;
        if (formData.lineColor !== undefined) this.pageSettings.userLineColor = formData.lineColor;
        // Update page settings
        if (formData.preview !== undefined) this.pageSettings.preview = formData.preview;
        if (formData.keepZoomLevel !== undefined) this.pageSettings.keepZoomLevel = formData.keepZoomLevel;
        if (formData.disableKeyBinds !== undefined) this.pageSettings.disableKeyBinds = formData.disableKeyBinds;
        if (formData.isoRotation !== undefined) this.pageSettings.isoRotation = formData.isoRotation;

        // Handle roomStyle (mutually exclusive normal/frame/colored)
        if (formData.roomStyle !== undefined) {
            this.settings.frameMode = formData.roomStyle === "frame";
            this.settings.coloredMode = formData.roomStyle === "colored";
        }

        // Handle render mode (maps to frameMode/coloredMode/pencil)
        const isoRotationChanged = formData.isoRotation !== undefined && this.renderMode.startsWith("isometric");
        if ((formData.renderMode !== undefined && formData.renderMode !== this.renderMode) || isoRotationChanged) {
            this.applyRenderMode(formData.renderMode ?? this.renderMode);
        } else {
            this.renderer.updateBackground();
            this.applyBackground();
            this.renderer.refresh();
        }

        this.refreshPreview();
        this.saveSettings();
    }

    private refreshPreview() {
        if (!this.pageSettings.preview) return;
        const bounds = this.renderer.getAreaBounds();
        if (!bounds) return;
        const areaW = bounds.maxX - bounds.minX;
        const areaH = bounds.maxY - bounds.minY;
        if (areaW <= 0 || areaH <= 0) return;
        const MAX = 400;
        const aspect = areaW / areaH;
        const width = aspect >= 1 ? MAX : Math.round(MAX * aspect);
        const height = aspect >= 1 ? Math.round(MAX / aspect) : MAX;
        const canvas: HTMLCanvasElement | undefined = this.renderer.backend.toCanvas({width, height, padding: 3});
        if (!canvas) return;
        this.preview.init(bounds, canvas.toDataURL('image/png'));
    }

    private readMapInsets(): { top: number; right: number; bottom: number; left: number } {
        // CSS custom properties are returned as their declared value (e.g. "calc(...)") rather
        // than resolved pixels, so route them through a hidden probe whose real properties get
        // computed by the browser.
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
        localStorage.setItem("settings", JSON.stringify({
            ...this.settings,
            ...this.pageSettings,
            renderMode: this.renderMode,
        }));
    }

    render(force?: boolean) {
        return this.renderArea(parseInt(this.select.value), this.zIndex, force);
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

            // Capture preview data at fitArea() state before any zoom override
            const previewBounds = this.renderer.getViewportBounds();
            const previewPng = this.renderer.exportPng({pixelRatio: 0.25}) ?? null;

            const area = this.reader.getArea(areaId);
            this.select.value = String(areaId);
            if (area) {
                this.populateLevelButtons(area.getZLevels(), zIndex);
            }
            this.hideRoomInfo();

            // Re-render paths on the new area
            this.reRenderAllPaths();

            this.renderer.clearHighlights();
            if (this.pageSettings.keepZoomLevel && this.zoom) {
                this.renderer.zoomToCenter(this.zoom);
            }

            this.preview.init(previewBounds, previewPng);
            return true;
        }
        return false;
    }

    genericSetup() {
        document.querySelectorAll(".btn").forEach(element =>
            element.addEventListener("click", () => (element as HTMLElement).blur())
        );
    }

    populateLevelButtons(levels: number[], zIndex: number) {
        this.levels.innerHTML = "";
        if (levels.length <= 1) {
            return;
        }
        const levelsSorted = levels.slice().sort((a, b) => a - b);

        if (levelsSorted.length > 10) {
            const container = document.createElement("div");
            container.classList.add("dropdown");
            const button = document.createElement("button");
            button.classList.add("btn", "btn-secondary", "dropdown-toggle");
            button.setAttribute("type", "button");
            button.setAttribute("data-bs-toggle", "dropdown");
            button.append(document.createTextNode(String(zIndex)));
            const menu = document.createElement("div");
            menu.classList.add("dropdown-menu");
            container.append(button);
            container.append(menu);
            for (const level of levelsSorted) {
                const link = document.createElement("a");
                link.classList.add("dropdown-item", "btn-level");
                link.setAttribute("href", "#");
                link.setAttribute("data-level", String(level));
                link.append(document.createTextNode(String(level)));
                menu.append(link);
            }
            this.levels.append(container);
        } else {
            for (const level of levelsSorted) {
                const button = document.createElement("button");
                button.setAttribute("type", "button");
                button.setAttribute("data-level", String(level));
                button.classList.add("btn", "btn-level");
                if (level === zIndex) {
                    button.classList.add("btn-primary");
                } else {
                    button.classList.add("btn-secondary");
                }
                button.append(document.createTextNode(String(level)));
                this.levels.append(button);
            }
        }
        this.levels.querySelectorAll(".btn-level").forEach(item => {
            item.addEventListener("click", event => {
                event.preventDefault();
                const zIdx = parseInt((event.target as HTMLElement).getAttribute("data-level")!);
                this.renderArea(parseInt(this.select.value), zIdx);
            });
        });
    }

    populateAreaInfo(areaId: number) {
        const area = this.reader.getArea(areaId);
        if (!area) return;
        this.areaModal!.querySelector(".area-name")!.innerHTML = `${area.getAreaName()} (id: ${area.getAreaId()})`;
        const rooms = area.getRooms();
        this.areaModal!.querySelector(".area-room-count")!.innerHTML = String(rooms.length);
        const areaExits = this.areaModal!.querySelector(".area-exits")!;
        areaExits.innerHTML = "";
        rooms.flatMap(room => this.getAreaExits(room)).forEach(([id, targetId]) => {
            const targetArea = this.reader.getArea(this.reader.getRoom(targetId)?.area ?? 0);
            const li = document.createElement("li");
            const roomLink = document.createElement("a");
            roomLink.setAttribute("href", "#");
            roomLink.setAttribute("data-room", String(id));
            roomLink.appendChild(document.createTextNode(String(id)));
            roomLink.addEventListener("click", event => {
                event.preventDefault();
                this.findRoom(parseInt((event.currentTarget as HTMLElement).getAttribute("data-room")!));
            });
            const arrow = document.createTextNode(" -> ");
            const targetLink = document.createElement("a");
            targetLink.setAttribute("href", "#");
            targetLink.setAttribute("data-room", String(targetId));
            targetLink.appendChild(document.createTextNode(`${targetId} (${targetArea?.getAreaName() ?? "?"})`));
            targetLink.addEventListener("click", event => {
                event.preventDefault();
                this.findRoom(parseInt((event.currentTarget as HTMLElement).getAttribute("data-room")!));
            });
            li.append(roomLink, arrow, targetLink);
            areaExits.appendChild(li);
        });
    }

    getAreaExits(room: MapData.Room): [number, number][] {
        const areaExits: [number, number][] = [];
        Object.values(room.exits).filter(target => this.isExitTarget(target)).forEach(exitId => areaExits.push([room.id, exitId]));
        Object.values(room.specialExits).filter(target => this.isExitTarget(target)).forEach(exitId => areaExits.push([room.id, exitId]));
        return areaExits;
    }

    isExitTarget(destinationRoom: number): boolean {
        const destRoom = this.reader.getRoom(destinationRoom);
        if (!destRoom) return false;
        const currentArea = this.renderer.getCurrentArea();
        return destRoom.area !== currentArea?.getAreaId();
    }

    populateSelectBox() {
        this.select.querySelectorAll("option").forEach(item => item.remove());
        this.reader
            .getAreas()
            .filter(area => area.getRooms().length > 0 && area.getAreaName() !== undefined && area.getAreaName() !== "")
            .sort((a, b) => {
                const nameA = a.getAreaName().toLowerCase();
                const nameB = b.getAreaName().toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            })
            .forEach(areaElement => {
                if (!areaElement.getRooms().length) {
                    return;
                }
                this.select.append(new Option(areaElement.getAreaName(), String(areaElement.getAreaId())));
            });
        this.select.addEventListener("change", event => {
            this.renderArea(parseInt((event.target as HTMLSelectElement).value), 0);
        });
    }

    submitSearch() {
        Modal.getInstance(this.searchModal)?.hide();
        const inputs = this.search.querySelectorAll("input");

        const formData: Record<string, string> = {};
        inputs.forEach(element => {
            formData[element.name] = element.value;
            element.value = "";
        });

        if (formData.roomId !== undefined) {
            let roomId: any = formData.roomId.split(",");
            if (isNaN(roomId[0])) {
                roomId = findNpc(roomId);
            }
            this.findRooms(roomId);
        }
    }

    submitPathFind() {
        Modal.getInstance(this.findPathModal!)?.hide();
        const inputs = this.findPathForm!.querySelectorAll("input");

        const formData: Record<string, string> = {};
        inputs.forEach(element => {
            formData[element.name] = element.value;
            element.value = "";
        });
        if (this.findPath(formData["start-loc"], formData["end-loc"])) {
            this.findRoom(parseInt(formData["start-loc"]));
        }
    }

    findRoom(id: number) {
        if (!id) {
            return;
        }
        const room = this.reader.getRoom(id);
        if (room) {
            const areaChanged = this.renderArea(room.area, room.z);
            this.renderer.setZoom(0.5);
            this.renderer.centerOn(id, areaChanged);
            this.selectRoom(room);
        } else {
            this.showToast(translator.translateForKey("location-not-found", translator.currentLanguage));
        }
    }

    findRooms(rooms: (string | number)[]) {
        const firstRoom = this.reader.getRoom(parseInt(String(rooms[0])));
        if (firstRoom) {
            const areaChanged = this.renderArea(firstRoom.area, firstRoom.z);
            this.renderer.setZoom(0.5);
            this.renderer.centerOn(firstRoom.id, areaChanged);
            this.selectRoom(firstRoom);
            // Also highlight additional rooms if multiple
            if (rooms.length > 1) {
                rooms.slice(1).forEach(roomId => {
                    this.renderer.renderHighlight(parseInt(String(roomId)), "#FFFF00");
                });
            }
        } else {
            this.showToast(translator.translateForKey("location-not-found", translator.currentLanguage));
        }
    }

    findPath(from: string, to: string): boolean {
        const key = `${from}#${to}`;
        const existingColor = (this.pathBox.querySelector(`[data-path-key='${key}'] input[type='color']`) as HTMLInputElement)?.value;
        const pathColor = existingColor ?? rainbow[pathPick++ % rainbow.length];

        const pathLocations = this.pathFinder.findPath(parseInt(from), parseInt(to));
        if (!pathLocations) {
            this.showToast(translator.translateForKey("no-path", translator.currentLanguage));
            pathPick--;
            return false;
        }

        this.paths[key] = {locations: pathLocations, color: pathColor};
        this.reRenderAllPaths();

        if (!this.pathBox.querySelector(`[data-path-key='${key}']`)) {
            const pathSelector = document.createElement("li");
            pathSelector.classList.add("list-group-item", "d-inline-flex", "align-items-center", "position-relative");
            pathSelector.setAttribute("data-path-key", key);

            const color = document.createElement("input");
            color.setAttribute("type", "color");
            color.classList.add("small-color", "me-2");
            color.value = pathColor;
            color.addEventListener("input", () => {
                this.paths[key].color = color.value;
                this.reRenderAllPaths();
            });
            pathSelector.appendChild(color);

            pathSelector.appendChild(document.createTextNode(`${from} -> ${to}`));

            const deletePath = document.createElement("span");
            deletePath.classList.add("badge", "bg-secondary", "position-absolute", "end-0", "me-2");
            deletePath.appendChild(document.createTextNode(translator.translateForKey("delete", translator.currentLanguage)));
            deletePath.onclick = () => {
                delete this.paths[key];
                this.reRenderAllPaths();
                pathSelector.remove();

                if (Object.keys(this.paths).length === 0) {
                    this.pathBox.parentElement!.classList.add("invisible");
                }
            };
            pathSelector.appendChild(deletePath);
            this.pathBox.appendChild(pathSelector);
            this.pathBox.parentElement!.classList.remove("invisible");
        }
        return true;
    }

    reRenderAllPaths() {
        this.renderer.clearPaths();
        Object.entries(this.paths).forEach(([key, pathData]) => {
            const colorEl = (this.pathBox.querySelector(`[data-path-key='${key}'] input[type='color']`) as HTMLInputElement);
            const color = colorEl?.value ?? pathData.color;
            this.renderer.renderPath(pathData.locations, color);
        });
    }

    adjustZoomBar(detail: ZoomChangeEventDetail) {
        const minZoom = 0.1;
        const maxZoom = 5;
        const percentage = (detail.zoom - minZoom) / (maxZoom - minZoom);

        (this.zoomBar.querySelector(".progress-bar") as HTMLElement).style.width = percentage * 100 + "%";
        if (!this.zoomBar.classList.contains("visible")) {
            this.zoomBar.classList.add("visible");
            this.zoomBar.classList.remove("hidden");
            this.progressTimeout = setTimeout(() => {
                this.zoomBar.classList.add("hidden");
                this.zoomBar.classList.remove("visible");
            }, 3000);
        } else {
            if (this.progressTimeout !== undefined) {
                clearTimeout(this.progressTimeout);
                this.progressTimeout = undefined;
            }
            this.progressTimeout = setTimeout(() => {
                this.zoomBar.classList.add("hidden");
                this.zoomBar.classList.remove("visible");
            }, 3000);
        }
    }

    selectRoom(room: MapData.Room) {
        this.renderer.clearHighlights();
        this.selectedRoom = room;
        this.renderer.updatePositionMarker(room.id);
        this.showRoomInfo(room);
    }

    deselectRoom() {
        this.selectedRoom = null;
        this.renderer.clearHighlights();
        this.renderer.clearPosition();
        this.hideRoomInfo();
    }

    showRoomInfo(room: MapData.Room) {
        const bgColor = this.reader.getColorValue(room.env);
        this.infoBox.style.borderColor = bgColor.replace("rgb(", "rgba(").replace(")", ", 0.5)");
        this.infoBox.classList.add("visible");
        this.infoBox.querySelector(".room-id")!.innerHTML = String(room.id);
        (this.infoBox.querySelector(".room-link") as HTMLAnchorElement).setAttribute("href", `${url}?loc=${room.id}`);
        this.infoBox.querySelector(".room-name")!.innerHTML = room.name;
        this.infoBox.querySelector(".room-env")!.innerHTML = String(room.env);
        this.infoBox.querySelector(".coord-x")!.innerHTML = String(room.x);
        this.infoBox.querySelector(".coord-y")!.innerHTML = String(room.y);
        this.infoBox.querySelector(".coord-z")!.innerHTML = String(room.z);
        this.infoBox.querySelector(".room-hash")!.innerHTML = room.hash ?? "";

        this.infoExitsGroup(this.infoBox.querySelector(".exits")!, room.exits);
        this.infoExitsGroup(this.infoBox.querySelector(".special")!, room.specialExits);

        this.userDataGroup(this.infoBox.querySelector(".userData")!, room.userData);
        this.npcDataGroup(this.infoBox.querySelector(".npc")!, roomNpc[room.id] || []);
    }

    userDataGroup(container: HTMLElement, userData: Record<string, string>) {
        const containerList = container.querySelector("ul")!;
        containerList.innerHTML = "";
        let show = false;
        for (const userDataKey in userData) {
            show = true;
            const dataElement = document.createElement("li");
            dataElement.classList.add("user-data");
            const key = document.createElement("p");
            key.append(`${userDataKey}:`);
            const value = document.createElement("p");
            value.append(`${userData[userDataKey].replaceAll("\\n", "\n")}`);
            value.className = "value";
            dataElement.append(key, value);
            containerList.append(dataElement);
        }
        container.style.display = show ? "initial" : "none";
    }

    infoExitsGroup(container: HTMLElement, exits: Record<string, number>) {
        const containerList = container.querySelector("ul")!;
        containerList.innerHTML = "";
        let show = false;
        for (const exit in exits) {
            show = true;
            containerList.append(this.infoExit(exit, exits[exit]));
        }
        container.style.display = show ? "initial" : "none";
    }

    npcDataGroup(container: HTMLElement, npcs: string[]) {
        const containerList = container.querySelector("ul")!;
        containerList.innerHTML = "";
        let show = false;
        for (const npc of npcs) {
            show = true;
            const element = document.createElement("li");
            element.append(document.createTextNode(npc));
            containerList.append(element);
        }
        container.style.display = show ? "initial" : "none";
    }

    infoExit(exit: string, id: number): HTMLElement {
        const exitElement = document.createElement("li");

        const exitDir = document.createElement("span");
        exitDir.setAttribute("data-i18n", exit);
        exitDir.innerHTML = this.translateDir(exit);
        exitElement.append(exitDir);
        exitElement.append(document.createTextNode(": "));

        const link = document.createElement("a");
        link.setAttribute("href", "#");
        link.setAttribute("data-room", String(id));
        link.innerHTML = String(id);
        link.addEventListener("click", event => {
            event.preventDefault();
            this.findRoom(parseInt((event.currentTarget as HTMLElement).getAttribute("data-room")!));
        });
        exitElement.append(link);

        const destRoom = this.reader.getRoom(id);
        if (destRoom) {
            const currentArea = this.renderer.getCurrentArea();
            if (destRoom.area !== currentArea?.getAreaId()) {
                const area = this.reader.getArea(destRoom.area);
                exitElement.append(document.createTextNode(" ->  "));
                const areaLink = document.createElement("a");
                areaLink.setAttribute("href", "#");
                areaLink.setAttribute("data-room", String(destRoom.id));
                areaLink.innerHTML = area?.getAreaName() ?? "?";
                areaLink.addEventListener("click", event => {
                    event.preventDefault();
                    this.findRoom(parseInt((event.currentTarget as HTMLElement).getAttribute("data-room")!));
                });
                exitElement.append(areaLink);
            }
        }

        return exitElement;
    }

    showToast(text: string) {
        this.toastContainer.querySelector(".toast-body")!.innerHTML = text;
        Toast.getOrCreateInstance(this.toastContainer).show();
    }

    translateDir(dir: string): string {
        return translator.translateForKey(dir) ?? dir;
    }

    translatePage(lang?: string) {
        this.currentLanguageFlag.classList.remove(`flag-${translator.currentLanguage}`);
        if (lang) {
            translator.translatePageTo(lang);
        }
        this.currentLanguageFlag.classList.add(`flag-${translator.currentLanguage}`);
    }

    hideRoomInfo() {
        this.infoBox.classList.remove("visible");
    }

    private suppressSettingsApply = false;

    populateSettings() {
        this.suppressSettingsApply = true;
        try {
            this.populateSettingsInner();
        } finally {
            this.suppressSettingsApply = false;
        }
    }

    private populateSettingsInner() {
        const allSettings: Record<string, any> = {...this.settings, ...this.pageSettings, renderMode: this.renderMode};
        // Merge transparentLabels back into labelRenderMode for the select
        if (allSettings.labelRenderMode === "data" && allSettings.transparentLabels) {
            allSettings.labelRenderMode = "data-transparent";
        }
        // Derive roomStyle from frame/colored mode flags
        allSettings.roomStyle = this.settings.frameMode ? "frame" : (this.settings.coloredMode ? "colored" : "normal");
        // Show user's color preferences in pickers, not the mode-overridden values
        if (this.pageSettings.userBackgroundColor) allSettings.backgroundColor = this.pageSettings.userBackgroundColor;
        if (this.pageSettings.userLineColor) allSettings.lineColor = this.pageSettings.userLineColor;
        const mapTab = this.settingsForm;
        if (!mapTab) return;

        for (const setting in allSettings) {
            // Try input first
            const input = mapTab.querySelector(`input[name='${setting}']`) as HTMLInputElement | null;
            if (input) {
                if (input.getAttribute("type") === "checkbox") {
                    input.checked = allSettings[setting];
                } else if (input.getAttribute("type") === "color") {
                    input.value = toHexColor(allSettings[setting]);
                } else {
                    input.value = allSettings[setting];
                    input.dispatchEvent(new Event("input", {bubbles: true}));
                }
                continue;
            }
            // Try select
            const select = mapTab.querySelector(`select[name='${setting}']`) as HTMLSelectElement | null;
            if (select) {
                select.value = allSettings[setting];
            }
        }
    }

    resetSettings() {
        const defaults = createSettings();
        const allDefaults: Record<string, any> = {
            ...defaults,
            preview: true,
            keepZoomLevel: false,
            disableKeyBinds: false,
            renderMode: "normal",
        };
        const mapTab = this.settingsForm;
        if (!mapTab) return;

        for (const setting in allDefaults) {
            const input = mapTab.querySelector(`input[name='${setting}']`) as HTMLInputElement | null;
            if (input) {
                if (input.getAttribute("type") === "checkbox") {
                    input.checked = allDefaults[setting];
                } else if (input.getAttribute("type") === "color") {
                    input.value = toHexColor(allDefaults[setting]);
                } else {
                    input.value = allDefaults[setting];
                }
                continue;
            }
            const select = mapTab.querySelector(`select[name='${setting}']`) as HTMLSelectElement | null;
            if (select) {
                select.value = allDefaults[setting];
            }
        }
        this.applyCurrentSettings();
    }

    saveImage() {
        const pngUrl = this.renderer.exportPng();
        if (!pngUrl) return;
        const a = document.createElement("a");
        a.setAttribute("href", pngUrl);
        a.setAttribute("download", (this.renderer.getCurrentArea()?.getAreaName() ?? "map") + ".png");
        document.querySelector("body")!.append(a);
        a.click();
        a.remove();
    }

    downloadImage() {
        const svg = this.renderer.exportSvg();
        if (!svg) return;
        const a = document.createElement("a");
        a.setAttribute("href", svgToDataURL(svg));
        a.setAttribute("download", (this.renderer.getCurrentArea()?.getAreaName() ?? "map") + ".svg");
        document.querySelector("body")!.append(a);
        a.click();
        a.remove();
    }

    copyImage() {
        if (typeof ClipboardItem !== "undefined") {
            const blobPromise = this.renderer.exportPngBlob();
            if (blobPromise) {
                blobPromise.then(blob =>
                    navigator.clipboard.write([new ClipboardItem({"image/png": blob})])
                );
            }
            this.showToast(translator.translateForKey("copied", translator.currentLanguage));
        } else {
            this.showToast(translator.translateForKey("no-clipboard", translator.currentLanguage));
        }
    }

    goDirection(directionKey: string) {
        const fullDirection = dirsShortToLong(directionKey);
        if (this.selectedRoom && this.selectedRoom.exits[fullDirection as MapData.direction]) {
            this.findRoom(this.selectedRoom.exits[fullDirection as MapData.direction]);
        }
    }

    registerKeyBoard() {
        const directionKeys: Record<string, string> = {
            Numpad1: "sw",
            Numpad2: "s",
            Numpad3: "se",
            Numpad4: "w",
            Numpad6: "e",
            Numpad7: "nw",
            Numpad8: "n",
            Numpad9: "ne",
            NumpadMultiply: "u",
            NumpadDivide: "d",
        };

        window.addEventListener("keydown", event => {
            if (this.pageSettings.disableKeyBinds) {
                return;
            }

            if (event.code === "F1") {
                event.preventDefault();
                this.showHelp();
            }

            if (event.ctrlKey && event.code === "KeyF") {
                event.preventDefault();
                this.showSearch();
            }
        });

        window.addEventListener("keydown", event => {
            if (document.querySelector("input:focus") || this.pageSettings.disableKeyBinds) {
                return;
            }

            if (event.ctrlKey && event.code === "KeyS") {
                this.saveImage();
                event.preventDefault();
            }

            if (event.code === "Equal") {
                this.renderer.zoomToCenter(this.renderer.getZoom() * 1.1);
                event.preventDefault();
            }

            if (event.code === "Minus") {
                this.renderer.zoomToCenter(this.renderer.getZoom() * 0.9);
                event.preventDefault();
            }

            if (directionKeys.hasOwnProperty(event.code)) {
                this.goDirection(directionKeys[event.code]);
                event.preventDefault();
            }
        });
    }

    showHelp() {
        Modal.getOrCreateInstance(this.helpModal).show();
    }

    showSearch() {
        Modal.getOrCreateInstance(this.searchModal).show();
    }

    replaceVersion(tag: string) {
        downloadVersion(tag, this.versions!.getAttribute("data-files")!).then(data => {
            this.reader = new MapReader(data as MapData.Map, colors);
            this.pathFinder = new PathFinder(this.reader);
            this.renderer = new MapRenderer(this.reader, this.settings, this.map);
            if (this.renderMode !== "normal") this.applyRenderMode(this.renderMode);
            this.populateSelectBox();
            this.renderArea(this.areaId, this.zIndex, true);
            this.showToast(`Przeladowano wersje na ${tag}`);
            this.versionBadge.innerHTML = `v${tag}`;
            this.versionBadge.style.display = "initial";
        });
    }
}

const controls = new PageControls(new MapReader(mapData, colors));
(window as any).controls = controls;
controls.genericSetup();
controls.populateSelectBox();
controls.init();
controls.registerKeyBoard();

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

function getKeyByValue(obj: Record<string, string>, val: string): string | undefined {
    for (const k in obj) {
        if (obj.hasOwnProperty(k) && obj[k] === val) {
            return k;
        }
    }
    return undefined;
}

function dirsShortToLong(dir: string): string {
    const result = getKeyByValue(dirs, dir);
    return result !== undefined ? result : dir;
}
