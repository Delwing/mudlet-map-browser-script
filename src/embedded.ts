import {MapReader, MapRenderer, createSettings, PathFinder} from "mudlet-map-renderer";

const polishToEnglish: Record<string, string> = {
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
    ["gore"]: "up",
};

const longToShort: Record<string, string> = {
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

const exits: Record<string, string> = {
    e: "east",
    w: "west",
    n: "north",
    s: "south",
    sw: "southwest",
    se: "southeast",
    nw: "northwest",
    ne: "northeast",
    u: "up",
    d: "down",
};

function getLongDir(dir: string): string {
    return polishToEnglish[dir] ?? exits[dir] ?? dir;
}

function getShortDir(dir: string): string {
    return longToShort[dir] ?? dir;
}

class EmbeddedMap {
    map: HTMLDivElement;
    reader: MapReader;
    renderer: MapRenderer;
    pathFinder: PathFinder;
    gmcpPosition: any;
    event: EventTarget;
    hashes: Record<string, MapData.Room>;
    currentRoom: MapData.Room | undefined;

    constructor() {
        this.map = document.querySelector("#map") as HTMLDivElement;

        this.reader = new MapReader(mapData, colors);

        const settings = createSettings();
        this.renderer = new MapRenderer(this.reader, settings, this.map);
        this.pathFinder = new PathFinder(this.reader);
        this.gmcpPosition = {};
        this.event = new EventTarget();

        this.hashes = {};
        this.reader.getRooms().forEach(room => {
            if (room.hash) {
                this.hashes[room.hash] = room;
            }
        });

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
                        payload: this.parseCommand(e.data.data),
                    }, "https://arkadia.rpg.pl");
                    break;
            }
        });
    }

    renderRoomById(id: number) {
        const room = this.reader.getRoom(id);
        if (room) {
            this.renderRoom(room);
        }
    }

    renderRoom(room: MapData.Room) {
        this.renderer.drawArea(room.area, room.z);
        this.renderer.centerOn(room.id);
        this.renderer.setZoom(0.35);
        this.currentRoom = room;

        this.renderer.clearPaths();
        const pathLocations = this.pathFinder.findPath(room.id, 5168);
        if (pathLocations) {
            this.renderer.renderPath(pathLocations, "#FF0000");
        }
    }

    parseCommand(command: string): string {
        let commandToBeSent = command;
        if (command === "zerknij" || command === "spojrz" || command === "sp") {
            this.event.addEventListener("mapPosition", () => {
                this.setMapPosition(this.gmcpPosition);
            }, {once: true});
        }
        if (this.currentRoom) {
            const allExits: Record<string, number> = {...this.currentRoom.exits, ...this.currentRoom.specialExits};
            const potentialExit = getLongDir(command);
            if (!this.currentRoom.exits[potentialExit as MapData.direction]) {
                const foundExits = Object.entries(allExits).filter(([, id]) => {
                    const target = this.reader.getRoom(id);
                    return target && this.findRoomByExit(this.currentRoom!, target, getLongDir(command));
                }).map(([exit]) => exit);
                if (foundExits.length > 0) {
                    commandToBeSent = getShortDir(foundExits[0]);
                }
            }

            const targetId = allExits[getLongDir(commandToBeSent)];
            if (targetId) {
                this.renderRoomById(targetId);
            }
        }

        return commandToBeSent ?? command;
    }

    setMapPosition(data: any) {
        if (data && data.x && data.y && data.id && data.name) {
            const hash = `${data.x}:${data.y - 19}:0:${data.name}`;
            const room = this.hashes[hash];
            if (room) {
                this.renderRoom(room);
            }
        }
    }

    findRoomByExit(room: MapData.Room, targetRoom: MapData.Room, targetDir: string): boolean {
        const x = targetRoom.x;
        const y = targetRoom.y;
        const z = targetRoom.z;
        const c_x = room.x;
        const c_y = room.y;
        const c_z = room.z;

        if (targetDir === "south") return x === c_x && y > c_y && z === c_z;
        if (targetDir === "north") return x === c_x && y < c_y && z === c_z;
        if (targetDir === "east") return x > c_x && y === c_y && z === c_z;
        if (targetDir === "west") return x < c_x && y === c_y && z === c_z;
        if (targetDir === "northwest") return x < c_x && y > c_y && z === c_z;
        if (targetDir === "northeast") return x > c_x && y > c_y && z === c_z;
        if (targetDir === "southwest") return x < c_x && y < c_y && z === c_z;
        if (targetDir === "southeast") return x > c_x && y < c_y && z === c_z;
        if (targetDir === "down") return x === c_x && y === c_y && z < c_z;
        if (targetDir === "up") return x === c_x && y === c_y && z > c_z;
        return false;
    }
}

(window as any).embedded = new EmbeddedMap();
const embedded = (window as any).embedded as EmbeddedMap;
embedded.renderRoomById(3756);
embedded.parseCommand("n");
