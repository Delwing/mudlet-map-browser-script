import {useController} from "../map/context";
import {useLevels} from "../map/hooks";

export function LevelControls() {
    const controller = useController();
    const {levels, current} = useLevels();
    const hidden = levels.length <= 1;

    return (
        <span className="levels-container" style={hidden ? {display: "none"} : undefined}>
            <span className="control levels btn-group btn-group-toggle">
                {!hidden && levels.length > 10 ? (
                    <div className="dropdown">
                        <button className="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            {current}
                        </button>
                        <div className="dropdown-menu">
                            {levels.map(level => (
                                <a
                                    key={level}
                                    className="dropdown-item btn-level"
                                    href="#"
                                    data-level={level}
                                    onClick={e => {
                                        e.preventDefault();
                                        controller?.selectLevel(level);
                                    }}
                                >
                                    {level}
                                </a>
                            ))}
                        </div>
                    </div>
                ) : (
                    !hidden &&
                    levels.map(level => (
                        <button
                            key={level}
                            type="button"
                            data-level={level}
                            className={"btn btn-level " + (level === current ? "btn-primary" : "btn-secondary")}
                            onClick={() => controller?.selectLevel(level)}
                        >
                            {level}
                        </button>
                    ))
                )}
            </span>
            <select
                className="form-select levels-select"
                aria-label="Poziom"
                value={current}
                onChange={e => controller?.selectLevel(parseInt(e.target.value))}
            >
                {levels.map(level => (
                    <option key={level} value={level}>
                        {level}
                    </option>
                ))}
            </select>
        </span>
    );
}
