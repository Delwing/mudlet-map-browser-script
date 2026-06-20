import {createContext, useContext} from "react";
import type {MapController} from "./MapController";

export const MapControllerContext = createContext<MapController | null>(null);

export function useController(): MapController | null {
    return useContext(MapControllerContext);
}
