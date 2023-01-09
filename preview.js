const paper = require("paper");
/**
 * @typedef {Object} Renderer
 * @property {paper.PaperScope} paper
 */

/**
 * @typedef {Object} Controls
 * @property {Renderer} renderer
 */

class Preview {
    constructor(map, pageControls) {
        this.map = map;
        this.preview = document.querySelector(".preview-container");
        this.previewImgContainer = document.querySelector(".preview");
        this.previewImg = document.querySelector(".preview-img");
        this.previewPanContainer = document.querySelector(".preview-pan-container");
        this.previewPan = document.querySelector(".preview-pan");
        this.pageControls = pageControls;
    }

    /**
     *
     * @param {Controls} controls
     * @returns
     */
    init(controls) {
        this.controls = controls;
        this.view = controls.renderer.paper.view;
        window.view = this.view;
        this.backgroundLayer = controls.renderer.backgroundLayer;
        window.pv = this;
        window.backgroundLayer = this.backgroundLayer;
        this.baseBounds = {
            left: this.view.bounds.left,
            top: this.view.bounds.top,
        };
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                let width = this.view.size.width / this.backgroundLayer.bounds.width;
                let height = this.view.size.height / this.backgroundLayer.bounds.height;
                if (this.view.size.width > this.view.size.height) {
                    this.previewImg.style.maxWidth = `${width * 100}%`;
                    this.previewImg.style.maxHeight = `${1 * 100}%`;
                } else {
                    this.previewImg.style.maxWidth = `${1 * 100}%`;
                    this.previewImg.style.maxHeight = `${height * 100}%`;
                }
                this.previewImg.setAttribute("src", this.map.toDataURL());
                this.previewImg.addEventListener(
                    "load",
                    () => {
                        this.previewPanContainer.style.width = `${this.previewImg.width}px`;
                        this.previewPanContainer.style.height = `${this.previewImg.height}px`;
                        this.update();
                        resolve();
                    },
                    {once: true}
                );
                this.preview.style.opacity = 0;
                this.previewImgContainer.style.background = this.controls.renderer.settings.mapBackground;
                this.previewImg.style.background = this.controls.renderer.settings.mapBackground;
            }, 10);
        });
    }

    update() {
        if (!this.pageControls.settings.preview) {
            return;
        }
        this.preview.style.opacity = 1;
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => (this.preview.style.opacity = 0), 4000);
        let zoomFactor = this.view.minZoom / this.view.zoom;
        this.previewPan.style.width = `${zoomFactor * 100}%`;
        this.previewPan.style.height = `${zoomFactor * 100}%`;
        this.previewPan.style.left = `${-((this.baseBounds.left - this.view.bounds.left) / this.view.bounds.width) * (100 * zoomFactor)}%`;
        this.previewPan.style.top = `${-((this.baseBounds.top - this.view.bounds.top) / this.view.bounds.height) * (100 * zoomFactor)}%`;
    }
}

module.exports = {
    Preview: Preview,
};
