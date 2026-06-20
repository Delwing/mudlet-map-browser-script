import {useEffect, useRef, useState} from "react";
import {useController} from "../../map/context";
import {useI18n} from "../../i18n/I18n";
import type {AreaInfo} from "../../map/MapController";

export function AreaInfoModal() {
    const controller = useController();
    const {t} = useI18n();
    const ref = useRef<HTMLDivElement>(null);
    const [info, setInfo] = useState<AreaInfo | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || !controller) return;
        const handler = () => setInfo(controller.getAreaInfo(controller.areaId));
        el.addEventListener("show.bs.modal", handler);
        return () => el.removeEventListener("show.bs.modal", handler);
    }, [controller]);

    return (
        <div className="modal fade" id="area-info" tabIndex={-1} role="dialog" ref={ref}>
            <div className="modal-dialog" role="document">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title area-name">{info ? `${info.name} (id: ${info.id})` : ""}</h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div className="modal-body">
                        <p>
                            <span data-i18n="room-count">{t("room-count")}</span>: <span className="area-room-count">{info?.roomCount}</span>
                        </p>
                        <div className="area-exits-section">
                            <span data-i18n="exits">{t("exits")}</span>:
                            <ul className="area-exits">
                                {info?.exits.map((exit, i) => (
                                    <li key={i}>
                                        <a
                                            href="#"
                                            data-room={exit.fromId}
                                            onClick={e => {
                                                e.preventDefault();
                                                controller?.findRoom(exit.fromId);
                                            }}
                                        >
                                            {exit.fromId}
                                        </a>
                                        {" -> "}
                                        <a
                                            href="#"
                                            data-room={exit.targetId}
                                            onClick={e => {
                                                e.preventDefault();
                                                controller?.findRoom(exit.targetId);
                                            }}
                                        >
                                            {`${exit.targetId} (${exit.targetAreaName})`}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
