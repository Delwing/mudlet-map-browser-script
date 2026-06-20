import {useController} from "../map/context";
import {useVersion} from "../map/hooks";
import {useI18n} from "../i18n/I18n";
import {LanguageSelector} from "./LanguageSelector";
import {CopyIcon, DownloadIcon, GearIcon, QuestionCircleIcon, SearchIcon} from "./Icons";

export function Toolbar() {
    const controller = useController();
    const version = useVersion();
    const {t} = useI18n();

    return (
        <div className="controls flex-wrap btn-toolbar">
            <button className="control copy-image btn btn-secondary" title="Kopiuj obraz" onClick={() => controller?.copyImage()}>
                <CopyIcon />
                <span id="trn-copy" data-i18n="copy">
                    {t("copy")}
                </span>
            </button>
            <div className="btn-group control">
                <button className="save-image btn btn-secondary" title="Zapisz obraz" onClick={() => controller?.saveImage()}>
                    <DownloadIcon />
                    <span data-i18n="save">{t("save")}</span>
                </button>
                <button type="button" className="btn btn-secondary dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown">
                    <span className="visually-hidden">Dropdown</span>
                </button>
                <ul className="dropdown-menu">
                    <li>
                        <a
                            className="dropdown-item save-image"
                            href="#"
                            data-i18n="save-png"
                            onClick={e => {
                                e.preventDefault();
                                controller?.saveImage();
                            }}
                        >
                            {t("save-png")}
                        </a>
                    </li>
                    <li>
                        <a
                            className="dropdown-item save-image-svg"
                            href="#"
                            data-i18n="save-svg"
                            onClick={e => {
                                e.preventDefault();
                                controller?.downloadImage();
                            }}
                        >
                            {t("save-svg")}
                        </a>
                    </li>
                </ul>
            </div>
            <div className="btn-group control">
                <button className="search btn btn-secondary" data-bs-toggle="modal" data-bs-target="#search" title="Szukaj">
                    <SearchIcon />
                    <span data-i18n="search">{t("search")}</span>
                </button>
                <button type="button" className="btn btn-secondary dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown">
                    <span className="visually-hidden">Dropdown</span>
                </button>
                <ul className="dropdown-menu">
                    <li>
                        <a className="dropdown-item find-path" href="#" data-bs-toggle="modal" data-bs-target="#findpath" data-i18n="find-path">
                            {t("find-path")}
                        </a>
                    </li>
                </ul>
            </div>
            <button className="control settings btn btn-secondary" data-bs-toggle="modal" data-bs-target="#settings" title="Ustawienia">
                <GearIcon />
                <span data-i18n="settings">{t("settings")}</span>
            </button>
            <button className="control help btn btn-secondary" data-bs-toggle="modal" data-bs-target="#help" title="Pomoc">
                <QuestionCircleIcon />
                <span>
                    <span data-i18n="help">{t("help")}</span>{" "}
                    <span className="badge bg-secondary version-number" style={version ? {display: "initial"} : {display: "none"}}>
                        {version ? `v${version}` : ""}
                    </span>
                </span>
            </button>
            <LanguageSelector />
        </div>
    );
}
