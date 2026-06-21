/**
 * Light/dark UI theme for the app chrome (header, panels, modals).
 *
 * The theme is fixed at generation time via `MAP_CONFIG.theme` (set by the host
 * page / GitHub Action) — there is no in-app switcher. It is applied through
 * Bootstrap's `data-bs-theme` attribute on <html>, a single source of truth so
 * Bootstrap components (modals, dropdowns) and our own chrome stay in sync.
 * styles/style.css defines the dark palette on :root and overrides it under
 * [data-bs-theme="light"].
 *
 * Note: this is independent of the map canvas background (configured in the
 * settings modal) — the UI theme does not change the rendered map.
 */
import {config} from "./config";

export type Theme = "light" | "dark";

export function resolveTheme(): Theme {
    return config.theme === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
    document.documentElement.setAttribute("data-bs-theme", theme);
}
