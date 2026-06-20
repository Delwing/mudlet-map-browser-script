import {useController} from "../map/context";
import {useNpcLoaded, useSelectedRoom} from "../map/hooks";
import {useI18n} from "../i18n/I18n";

function RoomLink({id, label}: {id: number; label?: string}) {
    const controller = useController();
    return (
        <a
            href="#"
            data-room={id}
            onClick={e => {
                e.preventDefault();
                controller?.findRoom(id);
            }}
        >
            {label ?? id}
        </a>
    );
}

function ExitItem({dir, id}: {dir: string; id: number}) {
    const controller = useController();
    const {t} = useI18n();
    const destRoom = controller?.getRoom(id);
    const currentAreaId = controller?.selectedRoom?.area;
    const crossArea = destRoom && destRoom.area !== currentAreaId;
    const area = crossArea ? controller?.getArea(destRoom.area) : null;
    return (
        <li>
            <span data-i18n={dir}>{t(dir)}</span>
            {": "}
            <RoomLink id={id} />
            {crossArea && (
                <>
                    {" ->  "}
                    <RoomLink id={destRoom!.id} label={area?.getAreaName() ?? "?"} />
                </>
            )}
        </li>
    );
}

export function InfoBox() {
    const controller = useController();
    const room = useSelectedRoom();
    useNpcLoaded();
    const {t} = useI18n();

    const url = window.location.origin + window.location.pathname;
    const bgColor = room && controller ? controller.getColorValue(room.env) : "";
    const borderColor = bgColor ? bgColor.replace("rgb(", "rgba(").replace(")", ", 0.5)") : undefined;

    const exits = room ? Object.entries(room.exits) : [];
    const special = room ? Object.entries(room.specialExits) : [];
    const userData = room ? Object.entries(room.userData ?? {}) : [];
    const npcs = room && controller ? controller.getRoomNpc(room.id) : [];

    return (
        <div className={"info-box" + (room ? " visible" : "")} style={borderColor ? {borderColor} : undefined}>
            <p>
                <span data-i18n="location-id">{t("location-id")}</span>:{" "}
                <a className="room-link" href={room ? `${url}?loc=${room.id}` : "#"}>
                    <span className="room-id">{room?.id}</span>
                </a>
            </p>
            <p>
                <span data-i18n="name">{t("name")}</span>: <span className="room-name">{room?.name}</span>
            </p>
            <p>
                Env Id: <span className="room-env">{room?.env}</span>
            </p>
            <p>
                <span data-i18n="coordinates">{t("coordinates")}</span>:
            </p>
            <ul>
                <li>x: <span className="coord-x">{room?.x}</span></li>
                <li>y: <span className="coord-y">{room?.y}</span></li>
                <li>z: <span className="coord-z">{room?.z}</span></li>
                <li>Hash: <span className="room-hash">{room?.hash ?? ""}</span></li>
            </ul>
            <div className="exits" style={{display: exits.length ? "initial" : "none"}}>
                <p>
                    <span data-i18n="exits">{t("exits")}</span>:
                </p>
                <ul>
                    {exits.map(([dir, id]) => (
                        <ExitItem key={dir} dir={dir} id={id as number} />
                    ))}
                </ul>
            </div>
            <div className="special" style={{display: special.length ? "initial" : "none"}}>
                <p>
                    <span data-i18n="special">{t("special")}</span>:
                </p>
                <ul>
                    {special.map(([dir, id]) => (
                        <ExitItem key={dir} dir={dir} id={id as number} />
                    ))}
                </ul>
            </div>
            <div className="userData" style={{display: userData.length ? "initial" : "none"}}>
                <p>
                    <span data-i18n="other">{t("other")}</span>:
                </p>
                <ul>
                    {userData.map(([key, value]) => (
                        <li className="user-data" key={key}>
                            <p>{key}:</p>
                            <p className="value">{String(value).replaceAll("\\n", "\n")}</p>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="npc" style={{display: npcs.length ? "initial" : "none"}}>
                <p>
                    <span data-i18n="packages">{t("packages")}</span>:
                </p>
                <ul>
                    {npcs.map((npc, i) => (
                        <li key={i}>{npc}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
