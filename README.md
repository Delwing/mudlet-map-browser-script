# Mudlet Map Browser Script

A browser front-end for exploring [Mudlet](https://www.mudlet.org/) maps. It wraps
[`mudlet-map-renderer`](https://www.npmjs.com/package/mudlet-map-renderer) and wires it up to a
full interactive UI — area navigation, room search, path finding, image export, multiple visual
styles, and more — so a Mudlet map export can be browsed from any web page.

A working deployment is available at **https://delwing.github.io/arkadia-mapa/**.

## Capabilities

- **Area & level navigation** — area dropdown (sorted by name), per-level (`z-index`) buttons, with
  a dropdown fallback for areas with more than 10 levels.
- **Room inspection** — click any room to see its id, name, environment, coordinates, hash, normal
  and special exits (with cross-area links), custom Mudlet user data, and NPCs present in the room.
- **Search** — find rooms by id (single or comma-separated list) or by NPC name with
  autocomplete; matching rooms are centered and highlighted.
- **Path finding** — Dijkstra shortest path between two rooms; multiple paths can be drawn at once,
  each with its own editable color, and removed individually.
- **Image export** — download the current area as **PNG** or **SVG**, or copy a PNG straight to the
  clipboard.
- **Render modes** — switch the visual style of the map: `normal`, `pencil` (sketchy),
  `parchment`, `parchment-pencil`, `isometric` (with adjustable rotation), `isometric-parchment`,
  `blueprint`, `neon`, and `gradient`.
- **Customizable settings** — background/line colors, room size and shape, line width, label
  rendering, area names, area-exit labels, and more. Settings persist in `localStorage` and are
  migrated forward across versions.
- **Minimap preview** — a low-res overlay of the current area with a live viewport indicator that
  tracks zoom and pan.
- **Keyboard shortcuts** — `F1` help, `Ctrl+F` search, `Ctrl+S` save image, `+`/`-` zoom, and
  numpad keys (`1`–`9`, `*`, `/`) to step through exits from the selected room.
- **Internationalization** — built-in Polish/English translation, switchable from the UI and
  persisted between visits.
- **Theme selector** — pick any [Bootswatch](https://bootswatch.com/) theme plus a dark-mode
  toggle, persisted in `localStorage`.
- **Version switcher** — load older map versions from GitHub release tags and view their release
  notes without leaving the page.
- **Deep links** — open the page on a specific room (`?loc=`), area (`?area=`), or map version
  (`?version=`).

## Usage

The script is published to npm and is consumed in the browser as a bundled IIFE
(`dist/index.min.js`) plus a companion stylesheet (`dist/index.min.css`). The easiest way to
include them is via a CDN such as
[jsDelivr](https://www.jsdelivr.com/package/npm/mudlet-map-browser-script):

```html
<!-- Latest version -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/mudlet-map-browser-script/dist/index.min.css" />
<script src="https://cdn.jsdelivr.net/npm/mudlet-map-browser-script/dist/index.min.js"></script>

<!-- Pinned version -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/mudlet-map-browser-script@0.9.0/dist/index.min.css" />
<script src="https://cdn.jsdelivr.net/npm/mudlet-map-browser-script@0.9.0/dist/index.min.js"></script>
```

Or install it from npm to bundle yourself:

```bash
npm install mudlet-map-browser-script
# or
yarn add mudlet-map-browser-script
```

### Map data source

Point the script at a map via `window.MAP_CONFIG`. There are three ways to supply it, checked in
this order:

| Config                      | Source                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `mapUrl`                    | A Mudlet binary map (`.dat`) — decoded in-browser via [`mudlet-map-binary-reader`][reader] — **or** a combined `{ mapData, colors }` JSON file (extension decides). |
| `mapDataUrl` + `colorsUrl`  | The renderer export served as two JSON arrays (the `.json` equivalent of the old `mapExport.js` / `colors.js`). |
| _legacy globals_            | `mapData` / `colors` defined on `window` before the script runs. **Deprecated** — kept for back-compat; prefer `mapUrl`. |

[reader]: https://github.com/Delwing/node-mudlet-map-binary-reader

Loading a `.dat` directly is the simplest setup — no export step, and the binary is smaller than the
generated JS. Requires `mudlet-map-binary-reader` ≥ 1.0.1 (bundled into `dist/index.min.js`).

### Required page structure

The script is a self-contained **React** application that renders the entire UI itself. The host
page only needs a mount point (a `#root` element is used if present, otherwise one is created and
appended to `<body>`) and a configured map source:

```html
<link rel="stylesheet" href="index.min.css" />
<div id="root"></div>
<script>
  window.MAP_CONFIG = { mapUrl: "data/map.dat" }; // a .dat (decoded in-browser) or a .json export
</script>
<script src="index.min.js"></script>
```

All styling (Bootstrap, the app's own CSS, and the flag sprite) ships in `dist/index.min.css` — the
host needs no other stylesheet. The Polish and English UI translations are **bundled** too, so no
`i18n` files are required; you can override strings or add languages via `MAP_CONFIG` (below). The
only host-provided asset is the `favicon`.

#### Host configuration

The page is configured through a `window.MAP_CONFIG` global, set **before** the script runs:

```html
<script>
  window.MAP_CONFIG = {
    // Map data — a .dat (decoded in-browser) or a .json export. See "Map data source" above.
    mapUrl: "data/map.dat",
    // ...or two JSON arrays instead: mapDataUrl: "data/mapExport.json", colorsUrl: "data/colors.json",

    // Endpoints (default to the Arkadia deployment):
    npcUrl: "...",
    versionsTagsUrl: "...",
    versionsFilesUrl: "...",

    // Branding — no defaults are baked into the bundle:
    title: { pl: "Mapa Arkadii", en: "Arkadia Map" }, // string, or per-language map
    logo: "images/logo.png",                           // URL/path to a logo image; omit for no logo
    credits: {                                          // Help-modal footer; omit to hide entirely
      author: "Dargoth",
      githubUrl: "https://github.com/Delwing/mudlet-map-reader",
      remark: { pl: "...", en: "..." },                 // string or per-language map; may contain inline HTML
    },

    // Translations — Polish + English are bundled; override or extend here:
    translations: { en: { search: "Find" }, de: { search: "Suchen", settings: "Einstellungen" } },
    languages: [{ code: "pl" }, { code: "en", flag: "gb" }, { code: "de" }], // picker entries + flag sprite
  };
</script>
<script src="index.min.js"></script>
```

`title`, `logo`, and `credits` carry **no defaults** — the bundle is brand-neutral, and any of them
that you omit simply isn't shown (the header title falls back to the bundled `title` string). The
bundled Polish/English strings work out of the box; `translations` merges on top of them (tweak a
string or add a whole language) and `languages` controls the picker. See `demo/index.html` for a
complete example.

### URL parameters

| Parameter  | Effect                                              |
| ---------- | --------------------------------------------------- |
| `?loc=ID`  | Open centered on room `ID` and select it.           |
| `?area=ID` | Open on area `ID`.                                   |
| `?version=TAG` | Load the map version published under release `TAG`. |

## Development

```bash
yarn install     # install dependencies
yarn dev         # run the demo (Vite dev server) — see below
yarn build       # produce dist/index.min.js (+ source map)
yarn typecheck   # run the TypeScript compiler with --noEmit
```

`yarn dev` serves the demo from the `demo/` directory (Vite's dev root) — `demo/index.html` is the
minimal host shell (a `#root` mount point, `MAP_CONFIG.mapUrl` pointing at a Mudlet `.dat`, and the
app). It decodes the real Arkadia `.dat` in-browser and loads the favicon from the live deployment,
so you can develop against production-like data with no extra setup. It doubles as the reference for how a host page wires the
bundle in (the only difference in production is a `<script src="index.min.js">` tag instead of the
dev module).

The project is written in TypeScript + React and bundled with [Vite](https://vite.dev/) into a
single minified IIFE (see `vite.config.ts`); React is bundled in, so the host page needs no CDN
script. Source modules of note:

- `src/main.tsx` — the bundle entry point; mounts the React app into `#root`.
- `src/MapApp.tsx` — top-level component; instantiates the controller and lays out the UI.
- `src/map/MapController.ts` — framework-agnostic controller wrapping `mudlet-map-renderer`
  (areas, rooms, paths, settings, render modes, image export) and emitting state to React.
- `src/components/` — the UI (header, toolbar, modals, info box, minimap, paths, zoom, toasts).
- `src/i18n/` — translation provider; bundled Polish + English dictionaries, overridable via config.
- `src/preview.ts` — the minimap preview overlay (driven imperatively by the controller).
- `src/data/npc.ts` — NPC data loading; `src/versions.ts` — GitHub release tags / map versions.

Bootstrap's modals, dropdowns, and toasts are driven through its `data-bs-*` data API (Bootstrap's
JS is imported for its side effects in `src/main.tsx`).

## Publishing

Pushing a `*.*.*` tag triggers the
[`Publish to npm`](.github/workflows/publish.yml) GitHub Action, which builds the bundle and runs
`npm publish --provenance --access public`. The published package only ships the `dist/` folder.

## License

MIT
