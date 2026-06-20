import {useController} from "../map/context";
import {DashIcon, PlusIcon} from "./Icons";

export function ZoomControls() {
    const controller = useController();
    return (
        <div className="zoom-controls">
            <button className="btn btn-secondary btn-sm" data-factor="1.1" onClick={() => controller?.zoomBy(1.1)}>
                <PlusIcon />
            </button>
            <button className="btn btn-secondary btn-sm" data-factor="0.9" onClick={() => controller?.zoomBy(0.9)}>
                <DashIcon />
            </button>
        </div>
    );
}
