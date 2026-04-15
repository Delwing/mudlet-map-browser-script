/**
 * Preview minimap overlay for the browser-based map viewer.
 *
 * Shows a low-resolution snapshot of the current area with a viewport
 * indicator that reflects the current zoom level and pan position.
 */

import type {MapRenderer, ViewportBounds} from "mudlet-map-renderer";

const MAX_SIZE = 400;

export class Preview {
    private readonly map: HTMLDivElement;
    private readonly preview: HTMLElement;
    private readonly previewBg: HTMLElement;
    private readonly previewPan: HTMLElement;
    private readonly pageControls: any;

    private areaBounds: ViewportBounds | null = null;
    private timeout: ReturnType<typeof setTimeout> | undefined;

    constructor(map: HTMLDivElement, pageControls: any) {
        this.map = map;
        this.preview = document.querySelector(".preview-container") as HTMLElement;
        this.previewBg = document.querySelector(".preview") as HTMLElement;
        this.previewPan = document.querySelector(".preview-pan") as HTMLElement;
        this.pageControls = pageControls;

        this.map.addEventListener("pan", (() => {
            this.update();
        }) as EventListener);
    }

    /**
     * @param bounds   Viewport bounds captured right after fitArea().
     * @param pngDataUrl PNG captured at the same fitArea() state, or null.
     */
    init(bounds: ViewportBounds, pngDataUrl: string | null): void {
        this.areaBounds = bounds;

        const areaW = bounds.maxX - bounds.minX;
        const areaH = bounds.maxY - bounds.minY;
        if (areaW <= 0 || areaH <= 0) {
            this.preview.style.opacity = "0";
            return;
        }

        // Size the preview box to match the viewport aspect ratio
        const aspect = areaW / areaH;
        let boxW: number, boxH: number;
        if (aspect >= 1) {
            boxW = MAX_SIZE;
            boxH = MAX_SIZE / aspect;
        } else {
            boxH = MAX_SIZE;
            boxW = MAX_SIZE * aspect;
        }
        this.preview.style.width = `${Math.round(boxW)}px`;
        this.preview.style.height = `${Math.round(boxH)}px`;

        if (pngDataUrl) {
            this.previewBg.style.backgroundImage = `url(${pngDataUrl})`;
            this.previewBg.style.backgroundSize = "100% 100%";
            this.previewBg.style.opacity = "0.6";
        } else {
            this.previewBg.style.backgroundImage = "";
            this.previewBg.style.opacity = "";
        }

        this.update();
    }

    update(): void {
        if (!this.pageControls.pageSettings?.preview) {
            return;
        }

        this.preview.style.opacity = "1";
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            this.preview.style.opacity = "0";
        }, 4000);

        const renderer: MapRenderer = this.pageControls.renderer;
        if (!renderer || !this.areaBounds) {
            return;
        }

        const viewport = renderer.getViewportBounds();

        const areaW = this.areaBounds.maxX - this.areaBounds.minX;
        const areaH = this.areaBounds.maxY - this.areaBounds.minY;
        if (areaW <= 0 || areaH <= 0) return;

        const left = ((viewport.minX - this.areaBounds.minX) / areaW) * 100;
        const top = ((viewport.minY - this.areaBounds.minY) / areaH) * 100;
        const width = ((viewport.maxX - viewport.minX) / areaW) * 100;
        const height = ((viewport.maxY - viewport.minY) / areaH) * 100;

        const clampedLeft = Math.max(0, Math.min(left, 100));
        const clampedTop = Math.max(0, Math.min(top, 100));
        const clampedRight = Math.min(100, left + width);
        const clampedBottom = Math.min(100, top + height);

        this.previewPan.style.left = `${clampedLeft}%`;
        this.previewPan.style.top = `${clampedTop}%`;
        this.previewPan.style.width = `${Math.max(0, clampedRight - clampedLeft)}%`;
        this.previewPan.style.height = `${Math.max(0, clampedBottom - clampedTop)}%`;
    }
}
