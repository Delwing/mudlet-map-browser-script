import {useEffect} from "react";
import {Modal} from "bootstrap";
import type {MapController} from "../map/MapController";

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

function showModal(id: string) {
    const el = document.getElementById(id);
    if (el) Modal.getOrCreateInstance(el).show();
}

export function useKeyboardShortcuts(controller: MapController | null) {
    useEffect(() => {
        if (!controller) return;

        const onGlobal = (event: KeyboardEvent) => {
            if (controller.pageSettings.disableKeyBinds) return;
            if (event.code === "F1") {
                event.preventDefault();
                showModal("help");
            }
            if (event.ctrlKey && event.code === "KeyF") {
                event.preventDefault();
                showModal("search");
            }
        };

        const onMap = (event: KeyboardEvent) => {
            if (document.querySelector("input:focus") || controller.pageSettings.disableKeyBinds) {
                return;
            }
            if (event.ctrlKey && event.code === "KeyS") {
                controller.saveImage();
                event.preventDefault();
            }
            if (event.code === "Equal") {
                controller.zoomBy(1.1);
                event.preventDefault();
            }
            if (event.code === "Minus") {
                controller.zoomBy(0.9);
                event.preventDefault();
            }
            if (Object.prototype.hasOwnProperty.call(directionKeys, event.code)) {
                controller.goDirection(directionKeys[event.code]);
                event.preventDefault();
            }
        };

        window.addEventListener("keydown", onGlobal);
        window.addEventListener("keydown", onMap);
        return () => {
            window.removeEventListener("keydown", onGlobal);
            window.removeEventListener("keydown", onMap);
        };
    }, [controller]);
}
