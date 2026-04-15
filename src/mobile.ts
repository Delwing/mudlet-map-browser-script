import {MapRenderer, createSettings, MapReader} from "mudlet-map-renderer";

const reader = new MapReader(mapData, colors);
const settings = createSettings();
settings.areaName = false;

const renderer = new MapRenderer(
    reader,
    settings,
    document.getElementById("map") as HTMLDivElement,
);

(window as any).MapControls = {
    findRoom(roomId: number, zoom: number) {
        const room = reader.getRoom(roomId);
        if (!room) return;
        renderer.drawArea(room.area, room.z);
        renderer.setPosition(roomId);
        renderer.setZoom(zoom);
        renderer.centerOn(roomId);
    },
};
