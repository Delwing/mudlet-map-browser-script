import {useEffect, useState} from "react";
import {useController} from "./context";
import type {AreaOption, LevelsState, PathEntry, ToastMessage} from "./MapController";

export function useSelectedRoom(): MapData.Room | null {
    const controller = useController();
    const [room, setRoom] = useState<MapData.Room | null>(controller?.selectedRoom ?? null);
    useEffect(() => {
        if (!controller) return;
        setRoom(controller.selectedRoom);
        return controller.on("selected", setRoom);
    }, [controller]);
    return room;
}

export function useLevels(): LevelsState {
    const controller = useController();
    const [levels, setLevels] = useState<LevelsState>(controller?.getLevels() ?? {levels: [], current: 0});
    useEffect(() => {
        if (!controller) return;
        setLevels(controller.getLevels());
        return controller.on("levels", setLevels);
    }, [controller]);
    return levels;
}

export function usePaths(): PathEntry[] {
    const controller = useController();
    const [paths, setPaths] = useState<PathEntry[]>(controller?.getPaths() ?? []);
    useEffect(() => {
        if (!controller) return;
        setPaths(controller.getPaths());
        return controller.on("paths", setPaths);
    }, [controller]);
    return paths;
}

export function useCurrentArea(): number {
    const controller = useController();
    const [areaId, setAreaId] = useState<number>(controller?.areaId ?? 0);
    useEffect(() => {
        if (!controller) return;
        setAreaId(controller.areaId);
        return controller.on("area", setAreaId);
    }, [controller]);
    return areaId;
}

export function useAreas(): AreaOption[] {
    const controller = useController();
    const [areas, setAreas] = useState<AreaOption[]>(controller?.getAreas() ?? []);
    useEffect(() => {
        if (!controller) return;
        setAreas(controller.getAreas());
        return controller.on("areas", setAreas);
    }, [controller]);
    return areas;
}

export function useVersion(): string | null {
    const controller = useController();
    const [tag, setTag] = useState<string | null>(controller?.versionTag ?? null);
    useEffect(() => {
        if (!controller) return;
        setTag(controller.versionTag);
        return controller.on("version", setTag);
    }, [controller]);
    return tag;
}

/** NPC map load completion — returns a counter that bumps when NPC data arrives. */
export function useNpcLoaded(): number {
    const controller = useController();
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (!controller) return;
        return controller.on("npc", () => setTick(t => t + 1));
    }, [controller]);
    return tick;
}

export function useToasts(): ToastMessage[] {
    const controller = useController();
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    useEffect(() => {
        if (!controller) return;
        return controller.on("toast", msg => {
            setToasts(prev => [...prev, msg]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== msg.id));
            }, 2500);
        });
    }, [controller]);
    return toasts;
}
