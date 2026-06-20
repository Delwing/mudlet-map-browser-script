import {useController} from "../map/context";
import {useAreas, useCurrentArea} from "../map/hooks";
import {LevelControls} from "./LevelControls";
import {InfoCircleIcon} from "./Icons";

export function AreaControls() {
    const controller = useController();
    const areas = useAreas();
    const currentArea = useCurrentArea();

    return (
        <div className="map-controls">
            <form className="area-form">
                <select
                    className="form-select"
                    id="area"
                    value={currentArea}
                    onChange={e => controller?.selectArea(parseInt(e.target.value))}
                >
                    {areas.map(area => (
                        <option key={area.id} value={area.id}>
                            {area.name}
                        </option>
                    ))}
                </select>
            </form>
            <LevelControls />
            <span className="control">
                <button type="button" className="btn btn-secondary" data-bs-toggle="modal" data-bs-target="#area-info">
                    <InfoCircleIcon />
                </button>
            </span>
        </div>
    );
}
