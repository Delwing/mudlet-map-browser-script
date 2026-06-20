import {useEffect} from "react";

/** Prevent iOS Safari page pinch-zoom; the map library handles pinch itself. */
export function useGesturePrevention() {
    useEffect(() => {
        const prevent = (e: Event) => e.preventDefault();
        const events = ["gesturestart", "gesturechange", "gestureend"];
        events.forEach(evt => document.addEventListener(evt, prevent, {passive: false}));

        const onDblClick = (e: MouseEvent) => {
            if ((e.target as HTMLElement)?.closest(".map-container")) e.preventDefault();
        };
        document.addEventListener("dblclick", onDblClick, {passive: false});

        return () => {
            events.forEach(evt => document.removeEventListener(evt, prevent));
            document.removeEventListener("dblclick", onDblClick);
        };
    }, []);
}
