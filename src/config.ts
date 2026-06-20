/**
 * Host-configurable endpoints. These used to live as data-attributes in the
 * deployment's index.html (data-npc on the search input, data-tags / data-files
 * on the version <select>). Now that the markup is bundled, the host page supplies
 * them via MAP_CONFIG. They are brand-neutral with NO defaults — an unset endpoint
 * disables its feature (no NPC search, no version selector) rather than falling
 * back to any particular deployment:
 *
 *   <script>window.MAP_CONFIG = { npcUrl: "..." }</script>
 *   <script src="index.min.js"></script>
 */
/**
 * Optional "about" credits shown in the Help modal footer. The bundle ships NO
 * defaults — if `credits` is omitted, the block is not rendered at all. A host
 * supplies it via window.MAP_CONFIG (see demo/index.html for an example).
 */
export interface Credits {
    /** Author name, shown after the localized "Author:" label. */
    author?: string;
    /** GitHub (or any) URL, shown as "GitHub: <link>". */
    githubUrl?: string;
    /** Link text; defaults to the URL itself. */
    githubLabel?: string;
    /**
     * Free remark paragraph (may contain inline HTML). Either a single string,
     * or a per-language map (e.g. { pl: "...", en: "..." }) keyed by language code.
     */
    remark?: string | Record<string, string>;
}

export interface MapConfig {
    /**
     * NPC data file (room → name list), used to make NPCs searchable. Omit it and
     * NPC search is simply empty — only room-id search remains. No default: the
     * bundle is brand-neutral, so leaving it unset does NOT fall back to any
     * particular deployment's NPCs.
     */
    npcUrl?: string;
    /**
     * GitHub-releases (or compatible) endpoint listing selectable map versions.
     * Omit it and the version selector is hidden entirely. No default.
     */
    versionsTagsUrl?: string;
    /** Endpoint to fetch a specific version's map data; `%tag%` is substituted. Pairs with `versionsTagsUrl`. */
    versionsFilesUrl?: string;
    /**
     * Map data source. Three mutually-exclusive ways to supply it, checked in
     * this order (the legacy `mapData` / `colors` globals are the final fallback):
     *
     * 1. `mapUrl` — a Mudlet binary map (`.dat`) OR a combined JSON file. A `.dat`
     *    is decoded in-browser via `mudlet-map-binary-reader` (no build step, and
     *    the binary is smaller than the exported JS). A `.json` is read as the
     *    `{ mapData, colors }` shape returned by the reader's `export()`.
     * 2. `mapDataUrl` + `colorsUrl` — the renderer export served as two JSON
     *    arrays (the `.json` equivalent of the old `mapExport.js` / `colors.js`).
     */
    mapUrl?: string;
    /** JSON array of renderer areas (the old `mapExport.js` payload). Pair with `colorsUrl`. */
    mapDataUrl?: string;
    /** JSON array of env colors (the old `colors.js` payload). Pair with `mapDataUrl`. */
    colorsUrl?: string;
    credits?: Credits;
    /**
     * Header title. A single string or a per-language map keyed by language code.
     * Falls back to the `title` translation key when omitted.
     */
    title?: string | Record<string, string>;
    /**
     * Header logo: a URL or path to an image file (rendered as `<img class="logo">`).
     * No default — omit it to render no logo.
     */
    logo?: string;
    /**
     * Extra / overriding UI strings, keyed by language code then translation key.
     * Merged ON TOP of the bundled Polish + English dictionaries, so you can tweak
     * individual strings or add an entirely new language:
     *   translations: { en: { search: "Find" }, de: { search: "Suchen", ... } }
     */
    translations?: Record<string, Record<string, string>>;
    /**
     * Languages offered in the picker (and their flag-sprite suffix). Defaults to
     * Polish + English. Add an entry here to surface a language supplied via
     * `translations`: languages: [{ code: "pl" }, { code: "en", flag: "gb" }, { code: "de" }]
     */
    languages?: LanguageOption[];
}

export interface LanguageOption {
    /** Language code, e.g. "pl", "en", "de". */
    code: string;
    /** Flag sprite suffix (`.flag-<flag>`); defaults to the language code. */
    flag?: string;
}

/** Resolve a string-or-per-language-map value against the active language. */
export function resolveLocalized(value: string | Record<string, string> | undefined, lang: string): string | undefined {
    if (value == null) return undefined;
    if (typeof value === "string") return value;
    return value[lang] ?? Object.values(value)[0];
}

export const config: MapConfig = {...((window as unknown as {MAP_CONFIG?: Partial<MapConfig>}).MAP_CONFIG ?? {})};
