import {useEffect, useRef, useState, type MouseEvent} from "react";
import {useController} from "../../map/context";
import {useI18n} from "../../i18n/I18n";
import {collectForm, populateForm} from "./settingsForm";

export function SettingsModal() {
    const controller = useController();
    const {t} = useI18n();
    const modalRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const suppressRef = useRef(false);
    const applyScheduled = useRef(false);
    const [isoVisible, setIsoVisible] = useState(false);

    const updateRangeOutputs = () => {
        const form = formRef.current;
        if (!form) return;
        const setOut = (name: string, fmt: (v: number) => string) => {
            const input = form.querySelector<HTMLInputElement>(`input[name='${name}']`);
            const output = input?.parentElement?.querySelector("output");
            if (input && output) output.value = fmt(parseFloat(input.value));
        };
        setOut("roomSize", v => v.toFixed(2));
        setOut("lineWidth", v => v.toFixed(3));
        setOut("isoRotation", v => `${v}°`);
    };

    const populate = () => {
        const form = formRef.current;
        if (!form || !controller) return;
        suppressRef.current = true;
        try {
            const snapshot = controller.getSettingsSnapshot();
            populateForm(form, snapshot);
            setIsoVisible(String(snapshot.renderMode ?? "normal").startsWith("isometric"));
            updateRangeOutputs();
        } finally {
            suppressRef.current = false;
        }
    };

    useEffect(() => {
        const el = modalRef.current;
        if (!el || !controller) return;
        const onShow = () => populate();
        el.addEventListener("show.bs.modal", onShow);
        return () => el.removeEventListener("show.bs.modal", onShow);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controller]);

    const scheduleApply = () => {
        updateRangeOutputs();
        if (applyScheduled.current || suppressRef.current || !controller) return;
        applyScheduled.current = true;
        requestAnimationFrame(() => {
            applyScheduled.current = false;
            const form = formRef.current;
            if (!form) return;
            const data = collectForm(form);
            setIsoVisible(String(data.renderMode ?? "normal").startsWith("isometric"));
            controller.applySettings(data);
        });
    };

    const onReset = (e: MouseEvent) => {
        e.preventDefault();
        if (!controller) return;
        controller.resetSettings();
        populate();
    };

    const onColorReset = (targetId: string) => {
        const input = document.getElementById(targetId) as HTMLInputElement | null;
        if (!input) return;
        input.value = input.defaultValue;
        input.dispatchEvent(new Event("change", {bubbles: true}));
        scheduleApply();
    };

    return (
        <div className="modal fade" id="settings" tabIndex={-1} role="dialog" data-bs-theme="dark" data-bs-scroll="true" ref={modalRef}>
            <div className="modal-dialog" role="document">
                <div className="modal-content">
                    <form
                        className="settings-form"
                        data-settings-form
                        ref={formRef}
                        onSubmit={e => e.preventDefault()}
                        onInput={scheduleApply}
                        onChange={scheduleApply}
                    >
                        <div className="modal-header">
                            <h5 className="modal-title" data-i18n="settings">
                                {t("settings")}
                            </h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body">
                            <div className="tab-content" id="nav-tabContent">
                                <div className="tab-pane fade show active" id="nav-map" role="tabpanel">
                                    <div className="mb-3">
                                        <label className="form-label slider-label" htmlFor="location-size">
                                            <span data-i18n="location-size">{t("location-size")}</span>
                                            <output htmlFor="location-size"></output>
                                        </label>
                                        <input className="form-range" type="range" id="location-size" name="roomSize" step="0.05" min="0.1" max="1.5" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label slider-label" htmlFor="exits-size">
                                            <span data-i18n="line-thickness">{t("line-thickness")}</span>
                                            <output htmlFor="exits-size"></output>
                                        </label>
                                        <input className="form-range" type="range" id="exits-size" name="lineWidth" step="0.005" min="0.01" max="0.2" />
                                    </div>
                                    <div className="mb-3">
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" name="uniformLevelSize" value="1" id="uniformLevelSize" />
                                            <label className="form-check-label" htmlFor="uniformLevelSize" data-i18n="uniform-areas">
                                                {t("uniform-areas")}
                                            </label>
                                        </div>
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" name="keepZoomLevel" value="1" id="keepZoomLevel" />
                                            <label className="form-check-label" htmlFor="keepZoomLevel" data-i18n="keep-zoom-level">
                                                {t("keep-zoom-level")}
                                            </label>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label" htmlFor="room-shape" data-i18n="room-shape">
                                            {t("room-shape")}
                                        </label>
                                        <select className="form-select" id="room-shape" name="roomShape" defaultValue="rectangle">
                                            <option value="rectangle" data-i18n="rectangle">{t("rectangle")}</option>
                                            <option value="roundedRectangle" data-i18n="rounded-rectangle">{t("rounded-rectangle")}</option>
                                            <option value="circle" data-i18n="circle">{t("circle")}</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label" htmlFor="label-render-mode" data-i18n="label-render-mode">
                                            {t("label-render-mode")}
                                        </label>
                                        <select className="form-select" id="label-render-mode" name="labelRenderMode" defaultValue="image">
                                            <option value="image" data-i18n="label-image">{t("label-image")}</option>
                                            <option value="data" data-i18n="label-data">{t("label-data")}</option>
                                            <option value="data-transparent" data-i18n="label-data-transparent">{t("label-data-transparent")}</option>
                                            <option value="none" data-i18n="label-none">{t("label-none")}</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" name="borders" value="1" id="borders-check" />
                                            <label className="form-check-label" htmlFor="borders-check" data-i18n="location-borders">
                                                {t("location-borders")}
                                            </label>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label" htmlFor="render-mode" data-i18n="render-mode">
                                            {t("render-mode")}
                                        </label>
                                        <select className="form-select" id="render-mode" name="renderMode" defaultValue="normal">
                                            <option value="normal" data-i18n="render-normal">{t("render-normal")}</option>
                                            <option value="pencil" data-i18n="render-pencil">{t("render-pencil")}</option>
                                            <option value="parchment" data-i18n="render-parchment">{t("render-parchment")}</option>
                                            <option value="parchment-pencil" data-i18n="render-parchment-pencil">{t("render-parchment-pencil")}</option>
                                            <option value="isometric" data-i18n="render-isometric">{t("render-isometric")}</option>
                                            <option value="isometric-parchment" data-i18n="render-isometric-parchment">{t("render-isometric-parchment")}</option>
                                            <option value="blueprint" data-i18n="render-blueprint">{t("render-blueprint")}</option>
                                            <option value="neon" data-i18n="render-neon">{t("render-neon")}</option>
                                            <option value="gradient" data-i18n="render-gradient">{t("render-gradient")}</option>
                                        </select>
                                    </div>
                                    <div className="mb-3" id="iso-rotation-group" data-iso-rotation-group style={{display: isoVisible ? "" : "none"}}>
                                        <label className="form-label slider-label" htmlFor="iso-rotation">
                                            <span data-i18n="iso-rotation">{t("iso-rotation")}</span>
                                            <output htmlFor="iso-rotation"></output>
                                        </label>
                                        <input className="form-range" type="range" id="iso-rotation" name="isoRotation" min="0" max="360" step="5" defaultValue="30" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label" htmlFor="room-style" data-i18n="room-style">
                                            {t("room-style")}
                                        </label>
                                        <select className="form-select" id="room-style" name="roomStyle" defaultValue="normal">
                                            <option value="normal" data-i18n="render-normal">{t("render-normal")}</option>
                                            <option value="frame" data-i18n="render-frame">{t("render-frame")}</option>
                                            <option value="colored" data-i18n="render-colored">{t("render-colored")}</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" name="emboss" value="0" id="emboss-check" />
                                            <label className="form-check-label" htmlFor="emboss-check" data-i18n="emboss-locations">
                                                {t("emboss-locations")}
                                            </label>
                                        </div>
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" name="areaName" value="1" id="area-check" />
                                            <label className="form-check-label" htmlFor="area-check" data-i18n="area-names">
                                                {t("area-names")}
                                            </label>
                                        </div>
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" name="areaExitLabels" value="1" id="areaExitLabels" />
                                            <label className="form-check-label" htmlFor="areaExitLabels" data-i18n="area-exit-labels">
                                                {t("area-exit-labels")}
                                            </label>
                                        </div>
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" name="gridEnabled" value="1" id="grid-check" />
                                            <label className="form-check-label" htmlFor="grid-check" data-i18n="grid">
                                                {t("grid")}
                                            </label>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <div className="row row-cols-auto">
                                            <div className="col">
                                                <label htmlFor="map-background" className="form-label" data-i18n="background">
                                                    {t("background")}
                                                </label>
                                                <div className="color-group">
                                                    <input type="color" className="form-control form-control-color" id="map-background" name="backgroundColor" defaultValue="#000000" title="Wybierz kolor tła" />
                                                    <button type="button" className="color-reset" title="Reset" data-target="map-background" onClick={() => onColorReset("map-background")}>
                                                        ⟲
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="col">
                                                <label htmlFor="lineColor" className="form-label" data-i18n="line-color">
                                                    {t("line-color")}
                                                </label>
                                                <div className="color-group">
                                                    <input type="color" className="form-control form-control-color" id="lineColor" name="lineColor" defaultValue="#e1ffe1" title="Wybierz kolor linii" />
                                                    <button type="button" className="color-reset" title="Reset" data-target="lineColor" onClick={() => onColorReset("lineColor")}>
                                                        ⟲
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-check">
                                        <input className="form-check-input" type="checkbox" name="preview" value="1" id="preview-input" />
                                        <label className="form-check-label" htmlFor="preview-input" data-i18n="minimap">
                                            {t("minimap")}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="reset" className="btn btn-light" data-i18n="defaults" onClick={onReset}>
                                {t("defaults")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
