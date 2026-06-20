import {useEffect, useRef, useState} from "react";
import {useController} from "../map/context";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export function ZoomBar() {
    const controller = useController();
    const [percentage, setPercentage] = useState(0);
    const [visible, setVisible] = useState(false);
    const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        if (!controller) return;
        return controller.on("zoom", detail => {
            setPercentage(((detail.zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100);
            setVisible(true);
            if (timeout.current !== undefined) clearTimeout(timeout.current);
            timeout.current = setTimeout(() => setVisible(false), 3000);
        });
    }, [controller]);

    return (
        <div className={"progress-container" + (visible ? " visible" : " hidden")}>
            <div className="progress">
                <div className="progress-bar" role="progressbar" style={{width: `${percentage}%`}}></div>
            </div>
        </div>
    );
}
