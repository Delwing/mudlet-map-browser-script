import {useEffect, useRef, useState} from "react";
import {MapReader} from "mudlet-map-renderer";
import {loadMapData} from "./data/loadMapData";
import {MapController} from "./map/MapController";
import {MapControllerContext} from "./map/context";
import {useI18n} from "./i18n/I18n";
import {useKeyboardShortcuts} from "./hooks/useKeyboardShortcuts";
import {useGesturePrevention} from "./hooks/useGesturePrevention";
import {Header} from "./components/Header";
import {InfoBox} from "./components/InfoBox";
import {PreviewMinimap} from "./components/PreviewMinimap";
import {PathBox} from "./components/PathBox";
import {ZoomControls} from "./components/ZoomControls";
import {Toasts} from "./components/Toasts";
import {AreaInfoModal} from "./components/modals/AreaInfoModal";
import {SearchModal} from "./components/modals/SearchModal";
import {FindPathModal} from "./components/modals/FindPathModal";
import {SettingsModal} from "./components/modals/SettingsModal";
import {HelpModal} from "./components/modals/HelpModal";

export function MapApp() {
    const {t} = useI18n();
    const mapRef = useRef<HTMLDivElement>(null);
    const tRef = useRef(t);
    tRef.current = t;
    const [controller, setController] = useState<MapController | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!mapRef.current) return;
        let cancelled = false;
        loadMapData()
            .then(({mapData, colors}) => {
                if (cancelled || !mapRef.current) return;
                const reader = new MapReader(mapData, colors);
                // Route through tRef so language changes reach controller toasts.
                const ctrl = new MapController(mapRef.current, reader, {t: key => tRef.current(key)});
                ctrl.init();
                setController(ctrl);
                (window as any).controls = ctrl;
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                console.error("mudlet-map-browser: failed to load map data", err);
                setLoadError(err instanceof Error ? err.message : String(err));
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useKeyboardShortcuts(controller);
    useGesturePrevention();

    return (
        <MapControllerContext.Provider value={controller}>
            <Header />
            <AreaInfoModal />
            <SearchModal />
            <FindPathModal />
            <SettingsModal />
            <HelpModal />
            <Toasts />
            <div className="map-container">
                <PreviewMinimap />
                <InfoBox />
                <PathBox />
                <ZoomControls />
                {loadError && (
                    <div className="map-load-error" role="alert">
                        {t("mapLoadError") || "Failed to load map data."}
                        <div className="map-load-error-detail">{loadError}</div>
                    </div>
                )}
                <div id="map" ref={mapRef}></div>
            </div>
        </MapControllerContext.Provider>
    );
}
