import {useI18n} from "../i18n/I18n";
import {config, resolveLocalized} from "../config";
import {AreaControls} from "./AreaControls";
import {Toolbar} from "./Toolbar";
import {ZoomBar} from "./ZoomBar";

export function Header() {
    const {t, lang} = useI18n();
    const title = resolveLocalized(config.title, lang) ?? t("title");

    return (
        <header>
            <div className="left-header">
                <h2>
                    {config.logo && <img className="logo" src={config.logo} alt="" />}
                    <a href="index.html">
                        <span id="title" data-i18n="title">
                            {title}
                        </span>
                    </a>
                </h2>
                <AreaControls />
            </div>
            <Toolbar />
            <ZoomBar />
        </header>
    );
}
