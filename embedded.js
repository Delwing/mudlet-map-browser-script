import {MapReader, Renderer, Settings} from "mudlet-map-renderer";
import convert from "color-convert";

const limit = 20;
const polishToEnglish = {
    ["polnoc"]: "north",
    ["poludnie"]: "south",
    ["wschod"]: "east",
    ["zachod"]: "west",
    ["polnocny-wschod"]: "northeast",
    ["polnocny-zachod"]: "northwest",
    ["poludniowy-wschod"]: "southeast",
    ["poludniowy-zachod"]: "southwest",
    ["dol"]: "down",
    ["gora"]: "up",
    ["gore"]: "up"
};
const longToShort = {
    north: "n",
    south: "s",
    east: "e",
    west: "w",
    northeast: "ne",
    northwest: "nw",
    southeast: "se",
    southwest: "sw",
    up: "u",
    down: "d"
};

const exits = {
    "e": "east",
    "w": "west",
    "n": "north",
    "s": "south",
    "sw": "southwest",
    "se": "southeast",
    "nw": "northwest",
    "ne": "northeast",
    "u": "up",
    "d": "down"
};

function getLongDir(dir) {
    return polishToEnglish[dir] ?? exits[dir] ?? dir;
}

function getShortDir(dir) {
    return longToShort[dir] ?? dir;
}

class EmbeddedMap {

    constructor() {
        this.map = document.querySelector("#map");
        this.reader = new MapReader(mapData, colors);
        this.settings = new Settings();
        this.renderer = new Renderer(this.map, this.reader, this.reader.getArea(1, 0), this.reader.getColors(), this.settings);
        this.gmcpPosition = {};
        this.event = new EventTarget();

        this.hashes = {};
        Object.values(this.reader.roomIndex).forEach(room => this.hashes[room.hash] = room);

        window.addEventListener("message", (e) => {
            switch (e.data.type) {
                case "mapPosition":
                    this.gmcpPosition = e.data.data;
                    this.event.dispatchEvent(new CustomEvent("mapPosition"));
                    break;
                case "refreshPosition":
                    this.setMapPosition(this.gmcpPosition);
                    break;
                case "command":
                    parent.postMessage({
                        type: "command",
                        payload: this.parseCommand(e.data.data)
                    }, "https://arkadia.rpg.pl");
                    break;
            }
        });
    }

    renderRoomById(id) {
        this.renderRoom(this.reader.getRoomById(id));
    }

    renderRoom(room) {
        if (room) {
            const area = this.reader.getAreaByRoomId(room.id, {
                xMin: room.x - limit,
                xMax: room.x + limit,
                yMin: room.y - limit,
                yMax: room.y + limit
            });
            this.renderer.clear();
            this.renderer = new Renderer(this.map, this.reader, area, this.reader.getColors(), this.settings);
            this.renderer.controls.centerRoom(room.id);
            this.renderer.controls.view.zoom = 0.35;

            this.currentRoom = room;

            this.renderer.controls.renderPath(
                this.currentRoom.id,
                5168,
                convert.hex.rgb("#FF0000").map(item => item / 255)
            );
        }
    }

    parseCommand(command) {
        let commandToBeSent = command;
        if (command === "zerknij" || command === "spojrz" || command === "sp") {
            this.event.addEventListener("mapPosition", () => {
                this.setMapPosition(this.gmcpPosition);
            }, {once: true});
        }
        if (this.currentRoom) {
            const allExits = Object.assign({}, this.currentRoom.exits, this.currentRoom.specialExits);
            const potentialExit = getLongDir(command);
            if (!this.currentRoom.exits[potentialExit]) {
                const exits = Object.entries(allExits).filter(([exit, id]) => {
                    const target = this.reader.getRoomById(id);
                    return this.findRoomByExit(this.currentRoom, target, getLongDir(command));
                }).map(([exit]) => exit);
                if (exits.length > 0) {
                    commandToBeSent = getShortDir(exits[0]);
                }
            }

            this.renderRoomById(allExits[getLongDir(commandToBeSent)]);
        }

        return commandToBeSent ?? command;
    }

    setMapPosition(data) {
        if (data && data.x && data.y && data.id && data.name) {
            const hash = `${data.x}:${data.y - 19}:0:${data.name}`;
            const room = this.hashes[hash];
            this.renderRoom(room);
        }
    }

    findRoomByExit(room, targetRoom, targetDir) {
        const x = targetRoom.x;
        const y = targetRoom.y;
        const z = targetRoom.z;
        const c_x = room.x;
        const c_y = room.y;
        const c_z = room.z;

        if (targetDir === "south") {
            return x === c_x && y > c_y && z === c_z;
        }
        if (targetDir === "north") {
            return x === c_x && y < c_y && z === c_z;
        }
        if (targetDir === "east") {
            return x > c_x && y === c_y && z === c_z;
        }
        if (targetDir === "west") {
            return x < c_x && y === c_y && z === c_z;
        }
        if (targetDir === "northwest") {
            return x < c_x && y > c_y && z === c_z;
        }
        if (targetDir === "northeast") {
            return x > c_x && y > c_y && z === c_z;
        }
        if (targetDir === "southwest") {
            return x < c_x && y < c_y && z === c_z;
        }
        if (targetDir === "southeast") {
            return x > c_x && y < c_y && z === c_z;
        }
        if (targetDir === "down") {
            return x === c_x && y === c_y && z < c_z;
        }
        if (targetDir === "up") {
            return x === c_x && y === c_y && z > c_z;
        }
    }

}

window.embedded = new EmbeddedMap();

embedded.renderRoomById(3756);
embedded.parseCommand("n");