import {Renderer, Settings, MapReader} from "mudlet-map-renderer";

let reader = new MapReader(mapData, colors);
let settings = new Settings();
settings.areaName = false;
let renderer;

window.MapControls = {
    findRoom: function (roomId, zoom) {
        let area = reader.getAreaByRoomId(roomId);
        area = area.limit(roomId, 15);
        if (renderer) {
            renderer.clear();
        }
        renderer = new Renderer(document.getElementById("map"), reader, area, reader.getColors(), settings);
        renderer.renderPosition(roomId);
        renderer.controls.setZoom(zoom);
        renderer.controls.centerRoom(roomId);
    },
};
