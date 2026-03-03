/// <reference path="../node_modules/mudlet-map-renderer/dist/types/MapData.d.ts" />

declare const mapData: MapData.Map;
declare const colors: MapData.Env[];
declare const translations: { pl: Record<string, string>; en: Record<string, string> };

declare module "@andreasremdt/simple-translator" {
    export default class Translator {
        constructor(options: any);
        currentLanguage: string;
        fetch(langs: string[], translate?: boolean): Promise<any>;
        add(key: string, value: any): void;
        translatePageTo(lang?: string): void;
        translateForKey(key: string, lang?: string): string;
    }
}

declare module "bootstrap" {
    export class Modal {
        static getInstance(element: Element): Modal | null;
        static getOrCreateInstance(element: Element): Modal;
        hide(): void;
        show(): void;
    }
    export class Toast {
        static getOrCreateInstance(element: Element): Toast;
        show(): void;
    }
}

declare module "@tarekraafat/autocomplete.js" {
    export default class autoComplete {
        constructor(options: any);
        select(index: number): void;
        start(): void;
    }
}
