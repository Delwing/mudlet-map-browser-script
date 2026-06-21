// Styles bundled into dist/index.min.css (Bootstrap + app CSS + flag sprite).
// Order matters: Bootstrap first, then app overrides.
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/translations.css";
import "./styles/style.css";
import "bootstrap";
import {createRoot} from "react-dom/client";
import {I18nProvider} from "./i18n/I18n";
import {MapApp} from "./MapApp";
import {applyTheme, resolveTheme} from "./theme";

// Apply the configured UI theme (MAP_CONFIG.theme, default dark) before first paint.
applyTheme(resolveTheme());

function mount() {
    let root = document.getElementById("root");
    if (!root) {
        root = document.createElement("div");
        root.id = "root";
        document.body.appendChild(root);
    }
    createRoot(root).render(
        <I18nProvider>
            <MapApp />
        </I18nProvider>,
    );
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
} else {
    mount();
}
