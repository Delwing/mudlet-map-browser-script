import {useController} from "../map/context";
import {usePaths} from "../map/hooks";
import {useI18n} from "../i18n/I18n";

export function PathBox() {
    const controller = useController();
    const paths = usePaths();
    const {t} = useI18n();

    return (
        <div className={"path-box card opacity-75" + (paths.length ? "" : " invisible")}>
            <div className="card-header" data-i18n="paths">
                {t("paths")}
            </div>
            <ul className="list-group list-group-flush">
                {paths.map(path => (
                    <li
                        key={path.key}
                        className="list-group-item d-inline-flex align-items-center position-relative"
                        data-path-key={path.key}
                    >
                        <input
                            type="color"
                            className="small-color me-2"
                            value={path.color}
                            onChange={e => controller?.setPathColor(path.key, e.target.value)}
                        />
                        {`${path.from} -> ${path.to}`}
                        <span
                            className="badge bg-secondary position-absolute end-0 me-2"
                            role="button"
                            onClick={() => controller?.removePath(path.key)}
                        >
                            {t("delete")}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
