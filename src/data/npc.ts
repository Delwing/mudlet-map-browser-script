/**
 * NPC ("package recipient") data: room -> names and name -> rooms.
 *
 * Pure data module — no DOM side effects. The search autocomplete that used to
 * live here now lives in the SearchModal component, which consumes
 * `getNpcLocations()` / `downloadNpc()`.
 */
import {config} from "../config";

interface Npc {
    name: string;
    loc: number;
}

export type RoomNpcMap = Record<number, string[]>;
export type NpcLocationMap = Record<string, number[]>;

const npcs: NpcLocationMap = {};

export const downloadNpc = async (): Promise<RoomNpcMap> => {
    const roomNpc: RoomNpcMap = {};
    const url = config.npcUrl;
    if (!url) {
        return roomNpc;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch NPCs: ${response.status} ${response.statusText}`);
    }

    const data: Npc[] = await response.json();
    data.forEach(npc => {
        if (!roomNpc[npc.loc]) {
            roomNpc[npc.loc] = [];
        }
        roomNpc[npc.loc].push(npc.name);
        npcs[npc.name] =
            npcs[npc.name] && npcs[npc.name].indexOf(npc.loc) === -1 ? npcs[npc.name].concat([npc.loc]) : [npc.loc];
    });

    return roomNpc;
};

export const findNpc = (name: string): number[] | false => {
    return npcs[name] ?? false;
};

export const getNpcLocations = (): NpcLocationMap => npcs;
